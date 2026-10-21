import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Html, Lightformer } from '@react-three/drei'
import { Bloom, DepthOfField, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode, type DepthOfFieldEffect } from 'postprocessing'
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { callouts, languages, projects } from './content'
import Background from './Background'
import {
  B, BOARD, BoardExtras, BoardPrimitive, Cable, Case, Cooler, Cpu, GLOW, GPU_SIZE, Glass, Gpu, GpuBodyPrimitive, IMPACTS,
  Impacts, Monitor, N_SSD, PCIE, PSU, Psu, RAM_H, RAM_SEAT, RAM_Z, RamBodyPrimitive, RamStick, RgbDriver, S, SOCKET, SSD_Y,
  Ssd, TraceGlow, V, ssdSlot,
} from './Parts'
import { GpuModel, ModelOr, MotherboardModel, RamModel, preloadModels, type ModelCfg } from './Models'

gsap.registerPlugin(ScrollTrigger)

// ===========================================================================
// TUNING
// SCROLL_VH: total scroll length of the story (in viewport heights).
// BEATS: how much of that scroll each beat gets (relative weights). Raise a
//   number to give that beat more scrolling; everything inside it rescales.
// SHOTS: camera per beat. The camera eases into `from`, then drifts to `to`
//   while the visitor reads. [position xyz, look-at target xyz].
// COLORS: glow / rim / dust colour per beat ('rgb' = cycling rainbow).
// MODELS: per-model tweaks for the Sketchfab models in public/models.
//   rot: [x, y] radians, applied before fitting (x first).
//   fit: scale the model so this axis (after rotation) has this size.
//   offset: extra nudge [x, y, z] after normalising (bottom centre = origin).
//   Slot positions on the board live in Parts.tsx (measured from motherboard.glb).
// ===========================================================================
export const SCROLL_VH = 850
export const BEATS = { hook: 0.8, cpu: 1.2, ram: 1.8, gpu: 1.0, ssd: 1.3, dwell: 1.3, power: 2.2, boot: 2.4 }
type Beat = keyof typeof BEATS
type Shot = { from: number[][]; to: number[][] }
const SHOTS: Record<Beat, Shot> = {
  hook: { from: [[1.1, 2.4, 3.8], [0.45, 0.85, 0]], to: [[0.9, 2.25, 3.45], [0.4, 0.8, 0]] }, // slow push-in
  cpu: { from: [[SOCKET.x + 0.85, 1.25, SOCKET.z + 1.15], [SOCKET.x, 0.14, SOCKET.z]], to: [[SOCKET.x + 0.55, 1.08, SOCKET.z + 1.02], [SOCKET.x, 0.16, SOCKET.z]] }, // socket close-up
  ram: { from: [[0.9, 0.9, 0.5], [0.2, 0.2, RAM_Z]], to: [[1.2, 1.0, -1.0], [0.2, 0.2, RAM_Z]] }, // orbit around the sticks
  gpu: { from: [[-0.75, 0.75, 1.75], [-0.3, 0.37, 0.15]], to: [[0.65, 0.78, 1.75], [0.2, 0.37, 0.15]] }, // side dolly
  ssd: { from: [[-0.45, 2.0, 1.0], [-0.42, 0.15, 0.45]], to: [[-0.38, 2.05, 0.82], [-0.38, 0.15, 0.45]] }, // top-down
  dwell: { from: [[-0.38, 2.05, 0.82], [-0.38, 0.15, 0.45]], to: [[-0.34, 1.98, 0.76], [-0.34, 0.15, 0.46]] },
  power: { from: [[1.95, 1.95, 2.35], [0.3, 0.2, 0.0]], to: [[1.55, 1.6, 2.0], [0.35, 0.2, -0.05]] }, // wide
  boot: { from: [[1.0, 1.75, 2.6], [0.2, 0.5, -0.5]], to: [[1.2, 2.4, 4.4], [0.2, 0.8, -0.9]] }, // slow pull-back
}
const COLORS: Record<Beat, string> = {
  hook: '#3a5cff', cpu: '#ffab40', ram: '#33e6ff', gpu: '#39ff88', ssd: '#3d7bff', dwell: '#3d7bff', power: '#ffe23d', boot: 'rgb',
}
const MODEL_URL = (f: string) => `${import.meta.env.BASE_URL}models/${f}`
export const MODELS: Record<'motherboard' | 'gpu' | 'ram', ModelCfg> = {
  // X570 Prime: board lies flat (model +Z up -> world +Y), long side along world z
  motherboard: { url: MODEL_URL('motherboard.glb'), rot: [-Math.PI / 2, 0], fit: { axis: 'z', size: BOARD.d }, offset: [0, 0, 0] },
  // RTX 3080: already long along x, fans facing +z; anchored at the PCB's bottom edge
  gpu: { url: MODEL_URL('gpu.glb'), rot: [0, 0], fit: { axis: 'x', size: GPU_SIZE.len }, offset: [0, 0, 0] },
  // Ballistix DDR4: stood up (connector down) and turned so its length runs along world z
  ram: { url: MODEL_URL('ram.glb'), rot: [-Math.PI / 2, Math.PI / 2], fit: { axis: 'y', size: RAM_H }, offset: [0, 0, 0] },
}
const BOARD_Y = B - 0.0077 // the model's PCB underside, so its PCB top lines up with B
// ===========================================================================

preloadModels(Object.values(MODELS))

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
  // GPU: its layers close up and it slides into the slot, fans start
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
  const camera = useThree((s) => s.camera)
  useEffect(() => { camera.layers.enable(1) }, [camera]) // layer 1 = decorative FX (no contact shadows)
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
    rim.current?.color.set('#7f9cff').lerp(GLOW, 0.7) // cool rim, tinted by the colour script
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
      <Environment resolution={256} frames={1} environmentIntensity={0.45}>
        <Lightformer form="rect" intensity={3} color="#ffe0bd" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[8, 4, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#7f9cff" position={[-6, 2, -4]} scale={[4, 2, 1]} />
        <Lightformer form="rect" intensity={0.9} color="#ffffff" position={[5, 1.5, 3]} rotation-y={-Math.PI / 3} scale={[3, 1.2, 1]} />
        <Lightformer form="ring" intensity={0.8} color="#ffffff" position={[6, 2, 5]} scale={2} />
      </Environment>
    </>
  )
}

// Desktop only: bloom on emissive parts, light depth of field on the look-at point, ACES, vignette, grain
function Effects() {
  const dof = useRef<DepthOfFieldEffect>(null)
  useFrame(() => dof.current?.target?.set(S.tgtX, S.tgtY, S.tgtZ))
  return (
    <EffectComposer multisampling={4}>
      <DepthOfField ref={dof} target={[0, 0, 0]} worldFocusRange={2.4} bokehScale={1.6} />
      <Bloom mipmapBlur intensity={0.5} luminanceThreshold={0.92} luminanceSmoothing={0.2} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.28} darkness={0.5} />
      <Noise premultiply opacity={0.35} />
    </EffectComposer>
  )
}

// ---------- HUD callouts: thin line + short label on the active part ----------
const CALLOUTS: { on: Section[]; pos: [number, number, number]; text: string }[] = [
  { on: ['cpu'], pos: [SOCKET.x, 0.45, SOCKET.z], text: callouts.cpu },
  { on: ['ram'], pos: [0.2, RAM_SEAT + RAM_H + 0.04, RAM_Z - 0.25], text: callouts.ram },
  { on: ['gpu'], pos: [0.3, PCIE.top + GPU_SIZE.h + 0.04, PCIE.z], text: callouts.gpu },
  { on: ['ssd'], pos: [ssdSlot(Math.min(N_SSD, 2) - 1).x + 0.2, SSD_Y + 0.03, ssdSlot(0).z], text: callouts.ssd },
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

// Fires once everything inside the Suspense boundary (models included) has mounted
function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    const id = requestAnimationFrame(() => onReady())
    return () => cancelAnimationFrame(id)
  }, [onReady])
  return null
}

export default function Scene({ name, touch, section, active, onHover, onPick, onReady }: {
  name: string; touch: boolean; section: Section; active: string | null
  onHover: (k: string | null) => void; onPick: (k: string | null) => void; onReady: () => void
}) {
  const aniso = touch ? 4 : 8
  const ramBody = (
    <ModelOr name="ram" fallback={<RamBodyPrimitive />}><RamModel cfg={MODELS.ram} anisotropy={aniso} /></ModelOr>
  )
  return (
    <>
      <ColorScript />
      <CameraRig />
      <Background touch={touch} />
      <Lights shadows={!touch} />
      <RgbDriver />
      <Case />
      <Suspense fallback={null}>
        <ModelOr name="motherboard" fallback={<BoardPrimitive />}>
          <MotherboardModel cfg={MODELS.motherboard} position={[BOARD.x, BOARD_Y, BOARD.z]} anisotropy={aniso} />
          <TraceGlow base={0} lift={0.004} />
        </ModelOr>
        <BoardExtras name={name} />
        <Cpu />
        <Cooler />
        {languages.slice(0, 4).map((l, i) => (
          <RamStick key={l.name} i={i} active={active === `ram-${i}`} onHover={onHover} onPick={onPick} body={ramBody} />
        ))}
        <Gpu body={<ModelOr name="gpu" fallback={<GpuBodyPrimitive />}><GpuModel cfg={MODELS.gpu} anisotropy={aniso} /></ModelOr>} />
        {projects.slice(0, N_SSD).map((p, i) => (
          <Ssd key={p.title} i={i} active={active === `ssd-${i}`} onHover={onHover} onPick={onPick} />
        ))}
        <Psu />
        {[0, 1, 2].map((i) => <Cable key={i} i={i} />)}
        <Glass />
        <Monitor />
        <Impacts />
        <Callouts section={section} />
        <Ready onReady={onReady} />
      </Suspense>
      {!touch && <ContactShadows position={[0.2, 0.002, -0.3]} scale={[6, 5]} resolution={512} blur={2.4} far={1.1} opacity={0.55} />}
      {!touch && <Effects />}
    </>
  )
}
