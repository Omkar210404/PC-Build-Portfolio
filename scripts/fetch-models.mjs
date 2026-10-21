// Finds, downloads and optimises the three Sketchfab models used by the scene.
//   node scripts/fetch-models.mjs            search, pick, download, optimise
//   node scripts/fetch-models.mjs --search   only print the candidate tables
//   node scripts/fetch-models.mjs --pick gpu=<uid>   override the automatic pick for a part
// Needs SKETCHFAB_TOKEN in .env.local (read here only, never printed).
// Licence rule: CC0 or CC Attribution only. Archives are treated as untrusted data.
import { readFileSync, writeFileSync, mkdirSync, rmSync, statSync, copyFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'models')
const TMP = join(ROOT, '.tmp-models') // git-ignored, wiped each run
const API = 'https://api.sketchfab.com/v3'
const ALLOWED = { 'CC0 Public Domain': 'cc0', 'CC Attribution': 'by' } // exact API labels

const PARTS = {
  motherboard: {
    queries: ['motherboard', 'pc motherboard', 'atx motherboard', 'computer mainboard'],
    must: /mother\s?board|mainboard|\batx\b|\bmobo\b/i,
    avoid: /\b(case|setup|room|desk|pack|collection|kit|set|scene|laptop|phone|rig|tower|full|build|parts)\b/i,
    minFaces: 5000, // fewer = detail painted into textures
    modern: /x570|x670|b550|b650|z690|z790|am4|am5|lga\s?1[27]\d\d|\batx\b/i,
  },
  gpu: {
    queries: ['graphics card', 'gpu', 'video card', 'rtx graphics card'],
    must: /graphics|\bgpu\b|video\s?card|\brtx\b|\bgtx\b|radeon|geforce/i,
    avoid: /\b(pack|collection|kit|set|case|setup|room|scene|miner|mining|rig|laptop|box|packaging)\b/i,
    minFaces: 5000, // fans must be real geometry so they can spin
    modern: /\brtx\b|\brx\s?[5-7]\d{2,3}\b|geforce|radeon rx/i,
  },
  ram: {
    queries: ['ram stick', 'ddr4 ram', 'ram memory', 'ddr5 memory'],
    must: /\bram\b|\bddr\d?\b|memory\s?(stick|module)|\bdimm\b/i,
    avoid: /\b(pack|collection|kit|set|case|motherboard|setup|scene|laptop|phone|sodimm|so-dimm|ram ?truck|dodge)\b/i,
    minFaces: 500,
    modern: /ballistix|vengeance|trident|t-?force|fury|\brgb\b|heat\s?spreader/i,
  },
}

const args = process.argv.slice(2)
const searchOnly = args.includes('--search')
const overrides = Object.fromEntries(args.filter((a) => a.includes('=')).map((a) => a.split('=')))

function token() {
  const line = readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).find((l) => l.startsWith('SKETCHFAB_TOKEN='))
  const t = line?.slice('SKETCHFAB_TOKEN='.length).trim()
  if (!t) throw new Error('SKETCHFAB_TOKEN missing in .env.local')
  return t
}

async function getJson(url, auth = false) {
  const res = await fetch(url, auth ? { headers: { Authorization: `Token ${token()}` } } : {})
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url.replace(/\?.*/, '')}`)
  return res.json()
}

const facesOf = (m) => m.archives?.glb?.faceCount ?? m.faceCount ?? 0

function score(m, part) {
  const text = `${m.name} ${(m.tags ?? []).map((t) => t.name).join(' ')}`
  if (!ALLOWED[m.license?.label]) return null // licence gate
  if (!part.must.test(m.name) && !part.must.test(text)) return null
  if (part.avoid.test(m.name)) return null
  const faces = facesOf(m)
  const glb = m.archives?.glb
  if (!glb || !faces || faces > 200000) return null
  let s = 0
  s += faces <= 60000 ? 4 : faces <= 100000 ? 2.5 : faces <= 150000 ? 0.5 : -1 // light meshes first
  s += part.must.test(m.name) ? 2 : 0 // name, not only tags
  s += glb.textureCount >= 3 ? 2 : glb.textureCount >= 1 ? 1 : 0 // textured (PBR proxy)
  s += m.license.label === 'CC0 Public Domain' ? 0.5 : 0
  s += Math.min(3, Math.log10((m.likeCount ?? 0) + 1)) // community quality signal
  s += m.staffpickedAt ? 1 : 0
  s -= glb.size > 60e6 ? 2 : 0
  s -= faces < part.minFaces ? 4 : 0
  // premium modern PC look: reward current hardware / PBR detail, penalise consoles, legacy parts and low-poly
  s += part.modern.test(text) ? 1.5 : 0
  s += /\b(pbr|hq)\b/i.test(m.name) ? 1 : 0
  s -= /\b(ps[1-5]|console|xbox|playstation|nintendo|agp|ddr[123]|x1650|ati)\b/i.test(text) ? 4 : 0
  s -= /low[\s-]?poly/i.test(m.name) ? 1.5 : 0
  return s
}

async function search(name, part) {
  const seen = new Map()
  for (const q of part.queries) {
    for (const license of ['cc0', 'by']) {
      const url = `${API}/search?type=models&downloadable=true&count=24&max_face_count=200000&license=${license}&q=${encodeURIComponent(q)}`
      const { results = [] } = await getJson(url)
      for (const m of results) if (!seen.has(m.uid)) seen.set(m.uid, m)
    }
  }
  const ranked = [...seen.values()]
    .map((m) => ({ m, s: score(m, part) }))
    .filter((x) => x.s !== null)
    .sort((a, b) => b.s - a.s)
  console.log(`\n${name}: ${seen.size} candidates, ${ranked.length} pass the licence/quality rules`)
  console.table(ranked.slice(0, 8).map(({ m, s }) => ({
    score: s.toFixed(1), name: m.name.slice(0, 34), author: m.user?.displayName?.slice(0, 18),
    licence: m.license.label, faces: facesOf(m), tex: m.archives.glb.textureCount, url: m.viewerUrl,
  })))
  return ranked
}

// A .glb is safe to keep if it is a binary glTF 2.0 with no external URIs (everything embedded)
function validateGlb(file) {
  const buf = readFileSync(file)
  if (buf.toString('utf8', 0, 4) !== 'glTF' || buf.readUInt32LE(4) !== 2) throw new Error('not a glTF 2.0 binary')
  const jsonLen = buf.readUInt32LE(12)
  const json = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen))
  const external = [...(json.buffers ?? []), ...(json.images ?? [])].filter((x) => x.uri && !x.uri.startsWith('data:'))
  if (external.length) throw new Error('glb references external files')
  return json
}

async function download(name, m) {
  // Re-confirm the licence from the model endpoint before using it
  const info = await getJson(`${API}/models/${m.uid}`)
  if (!ALLOWED[info.license?.label]) throw new Error(`${name}: licence not confirmed (${info.license?.label})`)
  const dl = await getJson(`${API}/models/${m.uid}/download`, true)
  const src = dl.glb?.url
  if (!src) throw new Error(`${name}: no .glb archive offered`)
  const raw = join(TMP, `${name}.raw.glb`)
  const res = await fetch(src)
  if (!res.ok) throw new Error(`${name}: download failed ${res.status}`)
  writeFileSync(raw, Buffer.from(await res.arrayBuffer()))
  validateGlb(raw)
  // Optimise: keep node names (no flatten/join) so fans, LEDs and slots stay findable
  const out = join(OUT, `${name}.glb`)
  const opt = join(TMP, `${name}.opt.glb`)
  execFileSync('npx', ['--yes', '@gltf-transform/cli@4', 'optimize', raw, opt,
    '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', '1024',
    '--flatten', 'false', '--join', 'false', '--instance', 'false', '--palette', 'false',
    '--simplify-error', '0.0005'], { stdio: 'inherit', shell: process.platform === 'win32' })
  validateGlb(opt)
  copyFileSync(opt, out)
  return {
    part: name, uid: m.uid, title: info.name, author: info.user?.displayName, authorUrl: info.user?.profileUrl,
    licence: info.license.label, licenceUrl: info.license.url ?? null, source: info.viewerUrl,
    faces: facesOf(m), bytes: statSync(out).size,
  }
}

const picks = {}
for (const [name, part] of Object.entries(PARTS)) {
  const ranked = await search(name, part)
  const chosen = overrides[name] ? (await getJson(`${API}/models/${overrides[name]}`)) : ranked[0]?.m
  picks[name] = chosen ?? null
  console.log(chosen ? `  -> ${name}: ${chosen.name} (${chosen.uid})` : `  -> ${name}: nothing suitable, keep the primitive`)
}

if (!searchOnly) {
  rmSync(TMP, { recursive: true, force: true })
  mkdirSync(TMP, { recursive: true })
  mkdirSync(OUT, { recursive: true })
  const meta = []
  for (const [name, m] of Object.entries(picks)) {
    if (!m) continue
    try { meta.push(await download(name, m)) } catch (e) { console.warn(`  ! ${name}: ${e.message}; keeping the primitive`) }
  }
  writeFileSync(join(OUT, 'models.json'), JSON.stringify(meta, null, 2) + '\n')
  rmSync(TMP, { recursive: true, force: true })
  console.log('\nSaved:', meta.map((x) => `${x.part}.glb ${(x.bytes / 1024).toFixed(0)} KB`).join(', '))
}
