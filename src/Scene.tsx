import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment, Html, Lightformer } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { callouts, languages, projects } from './content'
import Background from './Background'
import {
  B, Case, Cable, Cooler, Cpu, GLOW, Glass, Gpu, IMPACTS, Impacts, Monitor, Motherboard, N_SSD, PSU,
  Psu, RAM_Z, RamStick, RgbDriver, S, SOCKET, Ssd, V, ssdSlot,
} from './Parts'

gsap.registerPlugin(ScrollTrigger)

// ===========================================================================
// TUNING
// SCROLL_VH: total scroll length of the story (in viewport heights).
// BEATS: how much of that scroll each beat gets (relative weights). Raise a
//   number to give that beat more scrolling; everything inside it rescales.
// SHOTS: camera per beat. The camera eases into `from`, then drifts to `to`
//   while the visitor reads. [position xyz, look-at target xyz].
// COLORS: glow / rim / dust colour per beat ('rgb' = cycling rainbow).
// ===========================================================================
export const SCROLL_VH = 850
export const BEATS = { hook: 0.8, cpu: 1.2, ram: 1.8, gpu: 1.0, ssd: 1.3, dwell: 1.3, power: 2.2, boot: 2.4 }
type Beat = keyof typeof BEATS
type Shot = { from: number[][]; to: number[][] }
const SHOTS: Record<Beat, Shot> = {
  hook: { from: [[1.1, 2.4, 3.8], [0.55, 0.85, 0]], to: [[0.9, 2.25, 3.45], [0.5, 0.8, 0]] }, // slow push-in
  cpu: { from: [[0.6, 1.25, 0.85], [SOCKET.x, 0.1, SOCKET.z]], to: [[0.3, 1.08, 0.72], [SOCKET.x, 0.13, SOCKET.z]] }, // socket close-up
  ram: { from: [[0.85, 0.85, 0.55], [0.15, 0.15, RAM_Z]], to: [[1.15, 0.95, -0.95], [0.15, 0.15, RAM_Z]] }, // orbit around the sticks
  gpu: { from: [[-0.8, 0.68, 1.6], [-0.4, 0.32, 0.12]], to: [[0.45, 0.72, 1.6], [0.05, 0.32, 0.12]] }, // side dolly
  ssd: { from: [[-0.3, 2.0, 0.95], [-0.3, 0.1, 0.4]], to: [[-0.24, 2.05, 0.78], [-0.24, 0.1, 0.4]] }, // top-down
  dwell: { from: [[-0.24, 2.05, 0.78], [-0.24, 0.1, 0.4]], to: [[-0.2, 1.98, 0.72], [-0.2, 0.1, 0.42]] },
  power: { from: [[1.95, 1.95, 2.35], [0.3, 0.2, 0.0]], to: [[1.55, 1.6, 2.0], [0.35, 0.2, -0.05]] }, // wide
  boot: { from: [[1.0, 1.75, 2.6], [0.2, 0.5, -0.5]], to: [[1.2, 2.4, 4.4], [0.2, 0.8, -0.9]] }, // slow pull-back
}
const COLORS: Record<Beat, string> = {
  hook: '#3a5cff', cpu: '#ffab40', ram: '#33e6ff', gpu: '#39ff88', ssd: '#3d7bff', dwell: '#3d7bff', power: '#ffe23d', boot: 'rgb',
}
// ===========================================================================

const ORDER = Object.keys(BEATS) as Beat[]
const RANGE = {} as Record<Beat, { start: number; end: number }>
let acc = 0
for (const b of ORDER) { RANGE[b] = { start: acc, end: acc + BEATS[b] }; acc += BEATS[b] }
export const END = acc
const CONTACT_AT = RANGE.boot.start + BEATS.boot * 0.55 // when the BIOS contact panel shows

export type Section = 'hook' | 'cpu' | 'ram' | 'gpu' | 'ssd' | 'power' | 'boot' | 'contact'
export function sectionAt(t: number): Section {
  if (t < RANGE.hook.end) return 'hook'
  if (t < RANGE.cpu.end) return 'cpu'
  if (t < RANGE.ram.end) return 'ram'
  if (t < RANGE.gpu.end) return 'gpu'
  if (t < RANGE.dwell.end) return 'ssd'
  if (t < RANGE.power.end) return 'power'
  if (t < CONTACT_AT) return 'boot'
  return 'contact'
}

const camVals = ([p, t]: number[][]) => ({ camX: p[0], camY: p[1], camZ: p[2], tgtX: t[0], tgtY: t[1], tgtZ: t[2] })

// Builds the master timeline, scrubbed directly by scroll. Called from App.tsx.
export function buildTimeline(track: HTMLElement, onUpdate: (time: number, progress: number) => void) {
  Object.assign(S, camVals(SHOTS.hook.from))
  const tl = gsap.timeline({
    defaults: { ease: 'power2.inOut' },
    scrollTrigger: {
      trigger: track, start: 'top top', end: 'bottom bottom', scrub: true, // no extra smoothing; Lenis is the only layer
      onUpdate: (st) => { S.t = st.progress * END; onUpdate(S.t, st.progress) },
    },
  })
  const at = (b: Beat, f: number) => RANGE[b].start + f * BEATS[b] // position inside a beat (0..1)
  const len = (b: Beat, f: number) => f * BEATS[b] // duration as a fraction of a beat
  const go = (vars: gsap.TweenVars, time: number, duration: number, ease = 'power2.inOut') => tl.to(S, { ...vars, duration, ease }, time)
  const snap = (k: string, time: number) => go({ [k]: 1 }, time, 0.14, 'power1.out') // impact ring + sparks

  // camera: ease into each shot, then drift through it while reading
  go(camVals(SHOTS.hook.to), 0, BEATS.hook, 'sine.inOut')
  for (const b of ORDER.slice(1)) {
    go(camVals(SHOTS[b].from), at(b, 0), len(b, 0.25))
    go(camVals(SHOTS[b].to), at(b, 0.25), len(b, 0.75), 'sine.inOut')
  }

  // CPU: drops in, load plate + lever lock, cooler mounts
  go({ cpu: 1 }, at('cpu', 0.22), len('cpu', 0.28), 'power2.in')
  snap('fx_cpu', at('cpu', 0.5))
  go({ plate: 1 }, at('cpu', 0.55), len('cpu', 0.12))
  go({ lever: 1 }, at('cpu', 0.66), len('cpu', 0.1), 'power3.in')
  go({ cooler: 1 }, at('cpu', 0.74), len('cpu', 0.16), 'power2.in')
  snap('fx_cooler', at('cpu', 0.9))
  // RAM: four sticks click in (back.out = settle bounce)
  languages.slice(0, 4).forEach((_, i) => {
    const s = at('ram', 0.18 + i * 0.16)
    go({ [`ram${i}`]: 1 }, s, len('ram', 0.12), 'back.out(3)')
    snap(`fx_ram${i}`, s + len('ram', 0.05))
  })
  // GPU: slides into the slot, fans start
  go({ gpu: 1 }, at('gpu', 0.22), len('gpu', 0.33), 'back.out(1.4)')
  snap('fx_gpu', at('gpu', 0.38))
  go({ gpuFan: 0.25 }, at('gpu', 0.6), len('gpu', 0.2))
  // SSDs (projects)
  const step = 0.7 / Math.max(N_SSD, 1)
  for (let i = 0; i < N_SSD; i++) {
    const s = at('ssd', 0.15 + i * step)
    go({ [`ssd${i}`]: 1 }, s, len('ssd', Math.min(0.15, step)), 'power2.in')
    snap(`fx_ssd${i}`, s + len('ssd', Math.min(0.15, step)))
  }
  tl.to({}, { duration: BEATS.dwell }, RANGE.dwell.start) // DWELL: parts stay put (idle motion keeps going)
  // POWER: PSU drops in, cables snap (overshoot), gauge fills, energy flows, traces light up in a wave
  go({ psu: 1 }, at('power', 0.04), len('power', 0.12), 'power2.in')
  snap('fx_psu', at('power', 0.16))
  go({ psuFan: 1 }, at('power', 0.22), len('power', 0.5))
  ;[0, 1, 2].forEach((i) => {
    const s = at('power', 0.22 + i * 0.15)
    go({ [`c${i}`]: 1 }, s, len('power', 0.12), 'back.out(2.2)')
    snap(`fx_c${i}`, s + len('power', 0.05))
    go({ gauge: (i + 1) / 3 }, s + len('power', 0.05), len('power', 0.06), 'power2.out')
  })
  go({ energy: 1 }, at('power', 0.68), len('power', 0.32), 'none')
  go({ wave: 1 }, at('power', 0.7), len('power', 0.25), 'power1.inOut')
  // BOOT: glass on, RGB on, fans up, monitor boots, contact form
  go({ glass: 1 }, at('boot', 0), len('boot', 0.15), 'power2.in')
  snap('fx_glass', at('boot', 0.15))
  go({ rgb: 1 }, at('boot', 0.18), len('boot', 0.08), 'none')
  go({ fan: 1 }, at('boot', 0.18), len('boot', 0.15))
  go({ boot: 1 }, at('boot', 0.22), len('boot', 0.3), 'none')
  return tl
}

// ---------- colour script: glow/rim/dust colour follows the scroll position ----------
function ColorScript() {
  const cols = useMemo(() => ORDER.map((b) => new THREE.Color(COLORS[b] === 'rgb' ? '#ffffff' : COLORS[b])), [])
  const prev = useMemo(() => new THREE.Color(), [])
  const cur = useMemo(() => new THREE.Color(), [])
  useFrame(({ clock }) => {
    const pick = (k: number, out: THREE.Color) =>
      COLORS[ORDER[k]] === 'rgb' ? out.setHSL((clock.elapsedTime * 0.12) % 1, 0.85, 0.55) : out.copy(cols[k])
    let k = ORDER.findIndex((b) => S.t < RANGE[b].end)
    if (k < 0) k = ORDER.length - 1
    const f = (S.t - RANGE[ORDER[k]].start) / BEATS[ORDER[k]]
    pick(Math.max(0, k - 1), prev)
    pick(k, cur)
    GLOW.copy(prev).lerp(cur, THREE.MathUtils.smoothstep(f, 0, 0.3))
  })
  return null
}

// ---------- camera: scrubbed shot applied directly, plus decorative sway ----------
function CameraRig() {
  const tgt = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, viewport, clock }, dt) => {
    // smoothed scroll speed, only used for decorative effects
    V.s += (Math.min(1, Math.abs(V.vel) / 35) - V.s) * Math.min(1, dt * 5)
    // pull the camera back on narrow screens so the board and parts still fit
    const a = viewport.aspect
    const pull = a < 1 ? 1 + (1 - a) * 2.0 : a < 1.3 ? 1 + (1.3 - a) * 0.5 : 1
    tgt.set(S.tgtX, S.tgtY, S.tgtZ)
    camera.position.set(tgt.x + (S.camX - tgt.x) * pull, tgt.y + (S.camY - tgt.y) * pull, tgt.z + (S.camZ - tgt.z) * pull)
    // handheld sway (idle), a little shake with scroll speed, and a nudge on each snap-in
    let nudge = 0
    for (const { k } of IMPACTS) { const f = S[k]; if (f > 0 && f < 1) nudge += Math.sin(f * Math.PI) * (1 - f) }
    const t = clock.elapsedTime
    camera.position.x += Math.sin(t * 0.45) * 0.015 + Math.sin(t * 7.1) * V.s * 0.01
    camera.position.y += Math.sin(t * 0.63 + 1) * 0.01 - nudge * 0.03
    camera.lookAt(tgt)
    const cam = camera as THREE.PerspectiveCamera
    cam.fov = 40 + V.s * 6 // FOV push while scrolling fast
    cam.updateProjectionMatrix()
  })
  return null
}

function Lights({ shadows }: { shadows: boolean }) {
  const spot = useRef<THREE.SpotLight>(null)
  const rim = useRef<THREE.DirectionalLight>(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  useFrame(() => {
    spot.current?.position.set(S.tgtX + 0.6, 5.5, S.tgtZ + 1.6) // warm key light follows the shot
    target.position.set(S.tgtX, 0.2, S.tgtZ)
    target.updateMatrixWorld()
    rim.current?.color.set('#7f9cff').lerp(GLOW, 0.7)
  })
  return (
    <>
      <ambientLight intensity={0.07} color="#9fb2ff" />
      <primitive object={target} />
      <spotLight
        ref={spot} target={target} color="#ffd3a1" intensity={70} angle={0.5} penumbra={0.8}
        decay={2} distance={14} castShadow={shadows} shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004}
      />
      <directionalLight ref={rim} position={[-3, 3, -6]} intensity={1.3} />
      {/* procedural reflections, no HDRI download */}
      <Environment resolution={128} frames={1} environmentIntensity={0.4}>
        <Lightformer form="rect" intensity={3} color="#ffe0bd" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[8, 4, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#7f9cff" position={[-6, 2, -4]} scale={[4, 2, 1]} />
        <Lightformer form="ring" intensity={0.8} color="#ffffff" position={[6, 2, 5]} scale={2} />
      </Environment>
    </>
  )
}

// ---------- HUD callouts: thin line + short label on the active part ----------
const ssdRow = ssdSlot(Math.min(N_SSD, 3) - 1)
const CALLOUTS: { on: Section[]; pos: [number, number, number]; text: string }[] = [
  { on: ['cpu'], pos: [SOCKET.x, 0.42, SOCKET.z], text: callouts.cpu },
  { on: ['ram'], pos: [0.15, 0.32, RAM_Z - 0.28], text: callouts.ram },
  { on: ['gpu'], pos: [0.2, 0.62, 0.14], text: callouts.gpu },
  { on: ['ssd'], pos: [ssdRow.x + 0.2, B + 0.05, 0.36], text: callouts.ssd },
  { on: ['power'], pos: [PSU.x, 0.5, PSU.z], text: callouts.power },
  { on: ['boot', 'contact'], pos: [0.2, 1.9, -2.0], text: callouts.boot },
]
function Callouts({ section }: { section: Section }) {
  return (
    <>
      {CALLOUTS.map((c) => (
        <Html key={c.text} position={c.pos} zIndexRange={[1, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`callout ${c.on.includes(section) ? 'on' : ''}`}><i /><b /><span>{c.text}</span></div>
        </Html>
      ))}
    </>
  )
}

export default function Scene({ name, touch, section, active, onHover, onPick, onReady }: {
  name: string; touch: boolean; section: Section; active: string | null
  onHover: (k: string | null) => void; onPick: (k: string | null) => void; onReady: () => void
}) {
  useEffect(() => {
    const id = requestAnimationFrame(() => onReady())
    return () => cancelAnimationFrame(id)
  }, [onReady])

  return (
    <>
      <ColorScript />
      <CameraRig />
      <Background touch={touch} />
      <Lights shadows={!touch} />
      <RgbDriver />
      <Case />
      <Motherboard name={name} />
      <Cpu />
      <Cooler />
      {languages.slice(0, 4).map((l, i) => (
        <RamStick key={l.name} i={i} active={active === `ram-${i}`} onHover={onHover} onPick={onPick} />
      ))}
      <Gpu />
      {projects.slice(0, N_SSD).map((p, i) => (
        <Ssd key={p.title} i={i} active={active === `ssd-${i}`} onHover={onHover} onPick={onPick} />
      ))}
      <Psu />
      {[0, 1, 2].map((i) => <Cable key={i} i={i} />)}
      <Glass />
      <Monitor />
      <Impacts />
      <Callouts section={section} />
    </>
  )
}
