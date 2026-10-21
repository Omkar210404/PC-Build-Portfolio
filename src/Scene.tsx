import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Environment, Lightformer, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { aiml, languages, person, projects, sap, ui } from './content'

gsap.registerPlugin(ScrollTrigger)

// ---------------------------------------------------------------------------
// SCROLL TIMING. The master timeline runs from 0 to BOOT.end "units" and the
// whole scroll track maps onto it. To retime: change these numbers (keep them
// in order, each start = previous end). A longer range = more scrolling for it.
// Total scroll length is .track in styles.css.
// ---------------------------------------------------------------------------
export const HOOK = { start: 0, end: 1 }
export const CPU = { start: 1, end: 2.5 }
export const RAM = { start: 2.5, end: 4 }
export const GPU = { start: 4, end: 5.2 }
export const SSD = { start: 5.2, end: 6.6 }
export const DWELL = { start: 6.6, end: 7.6 } // everything still so visitors can hover the drives
export const POWER = { start: 7.6, end: 9.2 }
export const BOOT = { start: 9.2, end: 11 }
const CONTACT_AT = BOOT.start + 1.2 // when the BIOS contact panel shows

export type Section = 'hook' | 'cpu' | 'ram' | 'gpu' | 'ssd' | 'power' | 'boot' | 'contact'
export function sectionAt(t: number): Section {
  if (t < HOOK.end) return 'hook'
  if (t < CPU.end) return 'cpu'
  if (t < RAM.end) return 'ram'
  if (t < GPU.end) return 'gpu'
  if (t < DWELL.end) return 'ssd'
  if (t < POWER.end) return 'power'
  if (t < CONTACT_AT) return 'boot'
  return 'contact'
}

// ---------- layout (world units; desk top y = 0, board top y = B) ----------
const B = 0.1
const SOCKET = { x: -0.25, z: -0.3 }
const RAM_X = [0.04, 0.115, 0.19, 0.265]
const RAM_Z = -0.3
const PCIE_Z = 0.12
const N_SSD = Math.min(projects.length, 6)
const SSD_COLS = N_SSD <= 3 ? N_SSD : Math.ceil(N_SSD / 2)
const ssdSlot = (i: number) => ({ x: -0.45 + (i % SSD_COLS) * 0.42, z: 0.36 + Math.floor(i / SSD_COLS) * 0.16 })
const PSU = { x: 1.0, y: 0.22, z: 0.5 }

// Shared per-frame state. GSAP writes it, useFrame reads it. No React re-renders.
// Each part key goes 0 (exploded, hovering) -> 1 (installed).
const S: Record<string, number> = {
  camX: 1.0, camY: 2.3, camZ: 3.6, tgtX: 0.55, tgtY: 0.85, tgtZ: 0,
  cpu: 0, plate: 0, lever: 0, cooler: 0, gpu: 0, gpuFan: 0, psu: 0,
  glass: 0, rgb: 0, fan: 0, boot: 0,
  ram0: 0, ram1: 0, ram2: 0, ram3: 0, c0: 0, c1: 0, c2: 0,
}
for (let i = 0; i < N_SSD; i++) S[`ssd${i}`] = 0

// Builds the master timeline scrubbed by scroll. Called from App.tsx.
export function buildTimeline(track: HTMLElement, onUpdate: (time: number, progress: number) => void) {
  const tl = gsap.timeline({
    defaults: { ease: 'power2.inOut' },
    scrollTrigger: {
      trigger: track, start: 'top top', end: 'bottom bottom', scrub: true,
      onUpdate: (st) => onUpdate(st.progress * BOOT.end, st.progress),
    },
  })
  const cam = (at: number, pos: number[], tgt: number[], duration = 0.5) =>
    tl.to(S, { camX: pos[0], camY: pos[1], camZ: pos[2], tgtX: tgt[0], tgtY: tgt[1], tgtZ: tgt[2], duration }, at)

  // 1. CPU drops into the socket, load plate + lever lock, cooler mounts
  let t = CPU.start
  cam(t, [0.55, 1.55, 1.05], [SOCKET.x, B, SOCKET.z])
  tl.to(S, { cpu: 1, duration: 0.5, ease: 'power2.out' }, t + 0.3)
    .to(S, { plate: 1, duration: 0.2 }, t + 0.8)
    .to(S, { lever: 1, duration: 0.2, ease: 'power3.in' }, t + 0.95)
    .to(S, { cooler: 1, duration: 0.35, ease: 'power2.out' }, t + 1.1)
  // 2. RAM clicks in one by one (back.out = small settle bounce)
  t = RAM.start
  cam(t, [1.3, 1.15, -0.3], [0.15, 0.15, RAM_Z])
  languages.slice(0, 4).forEach((_, i) => tl.to(S, { [`ram${i}`]: 1, duration: 0.3, ease: 'back.out(3)' }, t + 0.3 + i * 0.22))
  // 3. GPU slides into the PCIe slot, fans start slowly
  t = GPU.start
  cam(t, [-0.1, 0.7, 1.75], [-0.15, 0.3, 0.1])
  tl.to(S, { gpu: 1, duration: 0.5, ease: 'back.out(1.4)' }, t + 0.3)
    .to(S, { gpuFan: 0.25, duration: 0.3 }, t + 0.8)
  // 4. SSDs (projects) slide into their M.2 slots
  t = SSD.start
  cam(t, [-0.3, 1.75, 1.25], [-0.3, 0.1, 0.42])
  const step = 1 / Math.max(N_SSD, 1)
  for (let i = 0; i < N_SSD; i++) tl.to(S, { [`ssd${i}`]: 1, duration: 0.35, ease: 'power2.out' }, t + 0.35 + i * step)
  tl.to({}, { duration: DWELL.end - DWELL.start }, DWELL.start) // DWELL: nothing moves
  // 5. PSU drops in, cables snap into their connectors one by one
  t = POWER.start
  cam(t, [1.65, 1.55, 1.9], [0.35, 0.2, 0.05])
  tl.to(S, { psu: 1, duration: 0.4, ease: 'power2.out' }, t + 0.2)
  ;[0, 1, 2].forEach((i) => tl.to(S, { [`c${i}`]: 1, duration: 0.35, ease: 'power1.inOut' }, t + 0.65 + i * 0.3))
  // 6. BOOT: glass slides on, RGB on, fans spin up, camera pulls back, monitor boots
  t = BOOT.start
  tl.to(S, { glass: 1, duration: 0.45 }, t)
    .to(S, { rgb: 1, duration: 0.2, ease: 'none' }, t + 0.5)
    .to(S, { fan: 1, duration: 0.4 }, t + 0.5)
  cam(t + 0.2, [1.1, 2.3, 4.1], [0.2, 0.75, -0.9], 0.9)
  tl.to(S, { boot: 1, duration: 0.8, ease: 'none' }, t + 0.6)
  return tl
}

// ---------- helpers ----------
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  draw(g)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return { tex, g }
}
const mix = (a: number, b: number, k: number) => a + (b - a) * k
const ACCENT = '#39ff88'

// RGB materials: dark until S.rgb, then cycle hues (driven in <RgbDriver/>)
const RGB_MATS = Array.from({ length: 6 }, () => new THREE.MeshBasicMaterial({ color: '#111318', toneMapped: false }))
const DARK = new THREE.Color('#111318')
const HUE = new THREE.Color()

// A part that hovers exploded and moves to its installed transform as S[key] goes 0 -> 1
function Part({ k, from, to, fromRot = [0, 0, 0], toRot = [0, 0, 0], seed = 0, children, ...events }: {
  k: string; from: number[]; to: number[]; fromRot?: number[]; toRot?: number[]; seed?: number; children: ReactNode
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void; onPointerOut?: (e: ThreeEvent<PointerEvent>) => void
  onClick?: (e: ThreeEvent<MouseEvent>) => void
}) {
  const ref = useRef<THREE.Group>(null)
  useFrame((state) => {
    const g = ref.current
    if (!g) return
    const p = S[k]
    const free = Math.max(0, 1 - p)
    const bob = Math.sin(state.clock.elapsedTime * 1.1 + seed * 1.7) * 0.03 * free
    g.position.set(mix(from[0], to[0], p), mix(from[1], to[1], p) + bob, mix(from[2], to[2], p))
    g.rotation.set(mix(fromRot[0], toRot[0], p), mix(fromRot[1], toRot[1], p) + bob, mix(fromRot[2], toRot[2], p))
  })
  return <group ref={ref} {...events}>{children}</group>
}

// Simple fan: frame ring, hub, pitched blades. Axis = local +y.
function Fan({ r, speed, rgb }: { r: number; speed: () => number; rgb?: number }) {
  const blades = useRef<THREE.Group>(null)
  useFrame((_, dt) => { if (blades.current) blades.current.rotation.y += speed() * dt * 25 })
  return (
    <group>
      <mesh rotation-x={Math.PI / 2}>
        <torusGeometry args={[r, r * 0.08, 6, 28]} />
        {rgb !== undefined ? <primitive object={RGB_MATS[rgb]} attach="material" /> : <meshStandardMaterial color="#1b1e25" />}
      </mesh>
      <group ref={blades}>
        <mesh>
          <cylinderGeometry args={[r * 0.28, r * 0.28, r * 0.2, 16]} />
          <meshStandardMaterial color="#20232b" roughness={0.4} />
        </mesh>
        {Array.from({ length: 7 }, (_, i) => (
          <mesh key={i} rotation={[0.35, (i / 7) * Math.PI * 2, 0, 'YXZ']} position={[Math.cos((i / 7) * Math.PI * 2) * r * 0.55, 0, -Math.sin((i / 7) * Math.PI * 2) * r * 0.55]}>
            <boxGeometry args={[r * 0.62, 0.006, r * 0.3]} />
            <meshStandardMaterial color="#2a2e38" roughness={0.5} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// ---------- motherboard with procedural circuit traces ----------
function useBoardTexture() {
  return useMemo(() => canvasTex(1024, 1024, (g) => {
    g.fillStyle = '#0d1d22'
    g.fillRect(0, 0, 1024, 1024)
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1], [-1, 0], [0, -1]]
    for (let n = 0; n < 420; n++) {
      let x = Math.round((Math.random() * 1024) / 8) * 8
      let y = Math.round((Math.random() * 1024) / 8) * 8
      g.strokeStyle = `rgba(70,150,120,${0.18 + Math.random() * 0.3})`
      g.lineWidth = Math.random() < 0.2 ? 3 : 1.5
      g.beginPath()
      g.moveTo(x, y)
      for (let s = 0; s < 3 + Math.random() * 3; s++) {
        const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)]
        const len = 16 + Math.random() * 90
        x += dx * len
        y += dy * len
        g.lineTo(x, y)
      }
      g.stroke()
      g.fillStyle = 'rgba(190,150,90,0.7)' // via / pad
      g.beginPath()
      g.arc(x, y, 3, 0, Math.PI * 2)
      g.fill()
    }
    g.fillStyle = 'rgba(230,230,220,0.55)'
    g.font = '600 22px "JetBrains Mono", monospace'
    g.fillText('PART-OF-ME  REV 1.0', 40, 990)
    g.fillText('CPU_SOCKET', 210, 140)
    g.fillText('DIMM_A1..B2', 560, 120)
    g.fillText('PCIE_X16', 60, 540)
    g.fillText('M2_1..6', 60, 690)
  }).tex, [])
}

function DebugDisplay({ name }: { name: string }) {
  const screen = useMemo(() => canvasTex(512, 200, () => {}), [])
  const last = useRef('')
  const start = useRef(performance.now())
  const line = `Hi, ${name}`
  useFrame(() => {
    // Types once on load (75 ms per char), then the cursor blinks
    const chars = Math.max(0, Math.min(line.length, Math.floor((performance.now() - start.current - 700) / 75)))
    const blink = Math.floor(performance.now() / 500) % 2 === 0
    const key = `${chars}${blink}`
    if (key === last.current) return
    last.current = key
    const { g, tex } = screen
    g.fillStyle = '#03110a'
    g.fillRect(0, 0, 512, 200)
    g.fillStyle = ACCENT
    g.shadowColor = ACCENT
    g.shadowBlur = 12
    g.font = '400 26px "JetBrains Mono", monospace'
    g.fillText('POST 00 · OK', 22, 42)
    const size = Math.min(64, Math.floor(820 / (line.length + 1)))
    g.font = `700 ${size}px "JetBrains Mono", monospace`
    const typed = line.slice(0, chars)
    g.fillText(typed, 22, 140)
    if (blink) g.fillRect(26 + g.measureText(typed).width, 140 - size * 0.78, size * 0.5, size * 0.9)
    g.shadowBlur = 0
    g.fillStyle = 'rgba(0,0,0,0.3)' // scanlines
    for (let y = 0; y < 200; y += 3) g.fillRect(0, y, 512, 1)
    tex.needsUpdate = true
  })
  return (
    <group position={[0.5, B, -0.42]} rotation-x={-0.55}>
      <mesh position={[0, 0.09, 0]}>
        <boxGeometry args={[0.34, 0.16, 0.025]} />
        <meshStandardMaterial color="#14171d" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.09, 0.0131]}>
        <planeGeometry args={[0.31, 0.12]} />
        <meshBasicMaterial map={screen.tex} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Motherboard({ name }: { name: string }) {
  const tex = useBoardTexture()
  const plate = useRef<THREE.Group>(null)
  const lever = useRef<THREE.Group>(null)
  useFrame(() => {
    if (plate.current) plate.current.rotation.x = -1.9 * (1 - S.plate)
    if (lever.current) lever.current.rotation.x = 1.1 * (1 - S.lever)
  })
  const metal = <meshStandardMaterial color="#2b2f38" metalness={0.7} roughness={0.35} />
  return (
    <group>
      <mesh position={[0, B - 0.015, 0]} receiveShadow>
        <boxGeometry args={[1.3, 0.03, 1.3]} />
        <meshStandardMaterial map={tex} roughness={0.6} />
      </mesh>
      {/* VRM heatsinks + rear I/O shroud + chipset */}
      <mesh position={[SOCKET.x, B + 0.04, SOCKET.z - 0.26]} castShadow><boxGeometry args={[0.5, 0.08, 0.1]} />{metal}</mesh>
      <mesh position={[SOCKET.x - 0.27, B + 0.04, SOCKET.z]} castShadow><boxGeometry args={[0.1, 0.08, 0.42]} />{metal}</mesh>
      <mesh position={[-0.6, B + 0.08, -0.3]} castShadow><boxGeometry args={[0.08, 0.16, 0.6]} />{metal}</mesh>
      <mesh position={[0.45, B + 0.02, 0.22]}><boxGeometry args={[0.22, 0.04, 0.16]} />{metal}</mesh>
      {/* CPU socket with load plate (hinged at back) and lever (hinged at front) */}
      <mesh position={[SOCKET.x, B + 0.01, SOCKET.z]}>
        <boxGeometry args={[0.3, 0.02, 0.3]} />
        <meshStandardMaterial color="#c2a46c" metalness={0.6} roughness={0.4} />
      </mesh>
      <group ref={plate} position={[SOCKET.x, B + 0.025, SOCKET.z - 0.15]}>
        {[[0, 0.01, 0.3, 0.02], [0, 0.29, 0.3, 0.02], [-0.14, 0.15, 0.02, 0.3], [0.14, 0.15, 0.02, 0.3]].map(([x, z, w, d], i) => (
          <mesh key={i} position={[x, 0, z]}><boxGeometry args={[w, 0.012, d]} />{metal}</mesh>
        ))}
      </group>
      <group ref={lever} position={[SOCKET.x + 0.17, B + 0.02, SOCKET.z + 0.15]}>
        <mesh position={[0, 0, -0.16]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.008, 0.008, 0.32, 6]} />
          <meshStandardMaterial color="#c9ccd2" metalness={0.9} roughness={0.25} />
        </mesh>
      </group>
      {/* RAM slots */}
      {RAM_X.map((x) => (
        <mesh key={x} position={[x, B + 0.015, RAM_Z]}><boxGeometry args={[0.03, 0.03, 0.66]} /><meshStandardMaterial color="#1a1c22" /></mesh>
      ))}
      {/* PCIe x16 slot */}
      <mesh position={[-0.28, B + 0.015, PCIE_Z]}><boxGeometry args={[0.7, 0.03, 0.035]} /><meshStandardMaterial color="#9aa0aa" metalness={0.8} roughness={0.3} /></mesh>
      {/* M.2 connectors + standoffs */}
      {Array.from({ length: N_SSD }, (_, i) => {
        const s = ssdSlot(i)
        return (
          <group key={i}>
            <mesh position={[s.x - 0.2, B + 0.01, s.z]}><boxGeometry args={[0.03, 0.02, 0.1]} /><meshStandardMaterial color="#1a1c22" /></mesh>
            <mesh position={[s.x + 0.17, B + 0.01, s.z]}><cylinderGeometry args={[0.01, 0.01, 0.02, 8]} /><meshStandardMaterial color="#c2a46c" metalness={0.8} /></mesh>
          </group>
        )
      })}
      {/* 24-pin and CPU 8-pin headers */}
      <mesh position={[0.6, B + 0.03, -0.05]}><boxGeometry args={[0.05, 0.06, 0.26]} /><meshStandardMaterial color="#e8e8e2" roughness={0.6} /></mesh>
      <mesh position={[-0.55, B + 0.03, -0.6]}><boxGeometry args={[0.12, 0.06, 0.05]} /><meshStandardMaterial color="#e8e8e2" roughness={0.6} /></mesh>
      <DebugDisplay name={name} />
    </group>
  )
}

// ---------- CPU + cooler ----------
function Cpu() {
  const ihs = useMemo(() => canvasTex(256, 256, (g) => {
    g.fillStyle = '#b9bcc2'
    g.fillRect(0, 0, 256, 256)
    g.fillStyle = 'rgba(40,44,52,0.85)'
    g.font = '700 22px "JetBrains Mono", monospace'
    g.fillText('O. S. NIKAM', 30, 110)
    g.font = '400 16px "JetBrains Mono", monospace'
    g.fillText('COMP. ENGG · 2026', 30, 140)
  }).tex, [])
  return (
    <Part k="cpu" from={[SOCKET.x, 1.35, -0.15]} to={[SOCKET.x, B + 0.02, SOCKET.z]} fromRot={[0.5, 0.3, 0]} seed={1}>
      <mesh position={[0, 0.005, 0]}><boxGeometry args={[0.26, 0.012, 0.26]} /><meshStandardMaterial color="#1f5a3a" roughness={0.6} /></mesh>
      <mesh position={[0, 0.02, 0]} castShadow><boxGeometry args={[0.2, 0.02, 0.2]} /><meshStandardMaterial color="#c4c7cd" metalness={0.85} roughness={0.3} /></mesh>
      <mesh position={[0, 0.0305, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[0.19, 0.19]} /><meshStandardMaterial map={ihs} metalness={0.7} roughness={0.35} /></mesh>
    </Part>
  )
}

function Cooler() {
  return (
    <Part k="cooler" from={[-0.95, 1.55, -0.95]} to={[SOCKET.x, B + 0.05, SOCKET.z]} fromRot={[0.35, 0.6, 0.1]} seed={2}>
      <mesh position={[0, 0.01, 0]}><boxGeometry args={[0.22, 0.02, 0.22]} /><meshStandardMaterial color="#b87333" metalness={0.8} roughness={0.3} /></mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[0, 0.04 + i * 0.016, 0]} castShadow={i === 8}>
          <boxGeometry args={[0.32, 0.005, 0.32]} />
          <meshStandardMaterial color="#c8ccd3" metalness={0.8} roughness={0.35} />
        </mesh>
      ))}
      <group position={[0, 0.2, 0]}>
        <Fan r={0.14} speed={() => 0.15 + S.fan} rgb={0} />
      </group>
    </Part>
  )
}

// ---------- RAM sticks (labels on the top spine, read from the right side) ----------
function RamStick({ i, active, onHover, onPick }: StickProps) {
  const lang = languages[i]
  const label = useMemo(() => canvasTex(512, 48, (g) => {
    g.fillStyle = '#0f1218'
    g.fillRect(0, 0, 512, 48)
    g.fillStyle = ACCENT
    g.font = '700 32px "JetBrains Mono", monospace'
    g.fillText(lang.name.toUpperCase(), 14, 35)
    g.fillStyle = 'rgba(255,255,255,0.35)'
    g.font = '400 18px "JetBrains Mono", monospace'
    g.fillText('DDR5 · 1x', 400, 32)
  }).tex, [lang.name])
  const key = `ram-${i}`
  return (
    <Part
      k={`ram${i}`} from={[0.15 + i * 0.17, 1.12 + i * 0.06, -0.6 + i * 0.03]} to={[RAM_X[i], B + 0.03, RAM_Z]}
      fromRot={[0.2, 0.3, 0.35]} seed={3 + i} {...hoverEvents(key, `ram${i}`, onHover, onPick)}
    >
      <group position-y={active ? 0.025 : 0}>
        <mesh position={[0, 0.07, 0]} castShadow><boxGeometry args={[0.02, 0.14, 0.6]} /><meshStandardMaterial color="#1d4a33" /></mesh>
        <mesh position={[0, 0.085, 0]}><boxGeometry args={[0.045, 0.12, 0.58]} /><meshStandardMaterial color="#20242c" metalness={0.6} roughness={0.35} /></mesh>
        <mesh position={[0, 0.15, 0]}><boxGeometry args={[0.042, 0.012, 0.56]} /><primitive object={RGB_MATS[1 + (i % 2)]} attach="material" /></mesh>
        <group position={[0, 0.1572, 0]} rotation-y={Math.PI / 2}>
          <mesh rotation-x={-Math.PI / 2}>
            <planeGeometry args={[0.5, 0.04]} />
            <meshBasicMaterial map={label} toneMapped={false} color={active ? '#ffffff' : '#cfd6d2'} />
          </mesh>
        </group>
      </group>
    </Part>
  )
}

// ---------- GPU ----------
function Gpu() {
  const top = useMemo(() => canvasTex(512, 64, (g) => {
    g.fillStyle = '#0f1218'
    g.fillRect(0, 0, 512, 64)
    g.fillStyle = 'rgba(255,255,255,0.8)'
    g.font = '700 30px Inter, sans-serif'
    g.fillText('AI / ML', 20, 44)
    g.fillStyle = 'rgba(255,255,255,0.4)'
    g.font = '400 20px "JetBrains Mono", monospace'
    g.fillText(aiml.slice(0, 3).join(' · '), 150, 42)
  }).tex, [])
  const W = 1.0, H = 0.42, T = 0.15
  const gpuFanSpeed = () => Math.max(S.gpuFan, S.fan)
  return (
    <Part k="gpu" from={[-0.4, 1.0, 0.6]} to={[-0.15, B + 0.01, PCIE_Z + 0.02]} fromRot={[0.15, 0.25, 0.05]} seed={7}>
      <mesh position={[0, H / 2 + 0.01, 0]} castShadow>
        <boxGeometry args={[W, H, T]} />
        <meshStandardMaterial color="#23272f" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.02, -0.01]}><boxGeometry args={[0.5, 0.04, 0.02]} /><meshStandardMaterial color="#c9a45c" metalness={0.9} roughness={0.3} /></mesh>
      <mesh position={[-W / 2 - 0.01, H / 2, 0]}><boxGeometry args={[0.02, H + 0.08, T + 0.02]} /><meshStandardMaterial color="#9aa0aa" metalness={0.9} roughness={0.3} /></mesh>
      {/* top edge: light bar + label */}
      <mesh position={[0, H + 0.0115, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.6, 0.075]} />
        <meshBasicMaterial map={top} toneMapped={false} />
      </mesh>
      <mesh position={[0.36, H + 0.012, 0]}><boxGeometry args={[0.2, 0.004, 0.06]} /><primitive object={RGB_MATS[3]} attach="material" /></mesh>
      {/* power connector on top */}
      <mesh position={[0.35, H + 0.03, -0.045]}><boxGeometry args={[0.08, 0.04, 0.035]} /><meshStandardMaterial color="#111" /></mesh>
      {/* two fans facing +z */}
      {[-0.24, 0.24].map((x) => (
        <group key={x} position={[x, H / 2 + 0.01, T / 2 + 0.005]} rotation-x={Math.PI / 2}>
          <Fan r={0.17} speed={gpuFanSpeed} rgb={4} />
        </group>
      ))}
    </Part>
  )
}

// ---------- SSDs (one per project) ----------
type StickProps = { i: number; active: boolean; onHover: (k: string | null) => void; onPick: (k: string | null) => void }

function hoverEvents(key: string, sKey: string, onHover: StickProps['onHover'], onPick: StickProps['onPick']) {
  const ready = () => S[sKey] > 0.9
  return {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      if (ready() && e.pointerType === 'mouse') { onHover(key); document.body.style.cursor = 'pointer' }
    },
    onPointerOut: (e: ThreeEvent<PointerEvent>) => {
      if (e.pointerType === 'mouse') { onHover(null); document.body.style.cursor = '' }
    },
    onClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (ready()) onPick(key) },
  }
}

function Ssd({ i, active, onHover, onPick }: StickProps) {
  const p = projects[i]
  const label = useMemo(() => canvasTex(512, 128, (g) => {
    g.fillStyle = '#e9e6df'
    g.fillRect(0, 0, 512, 128)
    g.fillStyle = p.color ?? ACCENT
    g.fillRect(0, 0, 16, 128)
    g.fillStyle = '#141820'
    let size = 46 // shrink long titles to fit
    g.font = `700 ${size}px Inter, sans-serif`
    while (g.measureText(p.title).width > 460 && size > 20) g.font = `700 ${(size -= 2)}px Inter, sans-serif`
    g.fillText(p.title, 34, 72)
    g.fillStyle = '#6a6f7a'
    g.font = '400 20px "JetBrains Mono", monospace'
    g.fillText(`NVMe M.2 · SLOT ${i + 1}`, 34, 108)
  }).tex, [p.title, p.color, i])
  const s = ssdSlot(i)
  const key = `ssd-${i}`
  return (
    <Part
      k={`ssd${i}`} from={[1.05 + (i % 2) * 0.5, 1.2 + Math.floor(i / 2) * 0.22, 0.05 + (i % 2) * 0.12]}
      to={[s.x, B + 0.025, s.z]} fromRot={[0.55, -0.3, 0.1]} toRot={[0, 0, 0]} seed={9 + i}
      {...hoverEvents(key, `ssd${i}`, onHover, onPick)}
    >
      <group position-y={active ? 0.03 : 0}>
        <mesh><boxGeometry args={[0.38, 0.012, 0.11]} /><meshStandardMaterial color="#173b2b" roughness={0.6} /></mesh>
        <mesh position={[0, 0.0065, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.34, 0.085]} />
          <meshStandardMaterial map={label} roughness={0.7} emissive={active ? ACCENT : '#000000'} emissiveIntensity={active ? 0.25 : 0} />
        </mesh>
      </group>
    </Part>
  )
}

// ---------- PSU + cables ----------
const CABLES = [
  [[0.84, 0.36, 0.32], [0.86, 0.45, 0.02], [0.72, 0.3, -0.05], [0.63, 0.17, -0.05]], // 24-pin ATX
  [[0.92, 0.36, 0.3], [1.08, 0.42, -0.2], [0.9, 0.45, -0.72], [-0.1, 0.45, -0.76], [-0.55, 0.3, -0.68], [-0.55, 0.17, -0.6]], // CPU 8-pin
  [[0.82, 0.36, 0.45], [0.6, 0.72, 0.32], [0.3, 0.72, 0.12], [0.2, 0.6, 0.08]], // GPU PCIe
].map((pts) => new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z))))

function Cable({ i }: { i: number }) {
  const geo = useMemo(() => new THREE.TubeGeometry(CABLES[i], 60, i === 0 ? 0.03 : 0.02, 8), [i])
  const plug = useRef<THREE.Mesh>(null)
  const total = geo.index!.count
  useFrame(() => {
    const p = Math.min(1, Math.max(0, S[`c${i}`]))
    geo.setDrawRange(0, Math.floor((total * p) / 48) * 48) // grow along the path
    if (plug.current) {
      plug.current.visible = p > 0.01
      plug.current.position.copy(CABLES[i].getPointAt(p))
    }
  })
  return (
    <>
      <mesh geometry={geo}>
        <meshStandardMaterial color="#121418" roughness={0.55} />
      </mesh>
      <mesh ref={plug}>
        <boxGeometry args={[i === 0 ? 0.06 : 0.05, 0.05, i === 0 ? 0.2 : 0.06]} />
        <meshStandardMaterial color="#0d0f12" roughness={0.5} />
      </mesh>
    </>
  )
}

function Psu() {
  const grille = useMemo(() => canvasTex(256, 256, (g) => {
    g.fillStyle = '#16191f'
    g.fillRect(0, 0, 256, 256)
    g.strokeStyle = '#2c313b'
    g.lineWidth = 3
    for (let r = 20; r < 110; r += 14) { g.beginPath(); g.arc(128, 128, r, 0, Math.PI * 2); g.stroke() }
    g.fillStyle = 'rgba(255,255,255,0.5)'
    g.font = '700 18px "JetBrains Mono", monospace'
    g.fillText('PSU · SAP', 82, 246)
  }).tex, [])
  return (
    <Part k="psu" from={[1.7, 0.85, 0.8]} to={[PSU.x, PSU.y, PSU.z]} fromRot={[0.2, -0.45, 0.12]} seed={14}>
      <RoundedBox args={[0.4, 0.34, 0.6]} radius={0.02} castShadow>
        <meshStandardMaterial color="#1c1f26" metalness={0.5} roughness={0.45} />
      </RoundedBox>
      <mesh position={[0, 0.171, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.36, 0.36]} />
        <meshStandardMaterial map={grille} metalness={0.4} roughness={0.5} />
      </mesh>
    </Part>
  )
}

// ---------- case (lying on its side) + glass panel + monitor ----------
function Case() {
  const wall = <meshStandardMaterial color="#14171d" metalness={0.6} roughness={0.45} />
  return (
    <group>
      <mesh position={[0.225, 0.025, 0.025]} receiveShadow><boxGeometry args={[2.15, 0.05, 1.75]} />{wall}</mesh>
      <mesh position={[0.225, 0.36, -0.84]} receiveShadow><boxGeometry args={[2.15, 0.7, 0.03]} />{wall}</mesh>
      <mesh position={[-0.84, 0.36, 0.025]} receiveShadow><boxGeometry args={[0.03, 0.7, 1.75]} />{wall}</mesh>
      <mesh position={[1.285, 0.36, 0.025]} receiveShadow><boxGeometry args={[0.03, 0.7, 1.75]} />{wall}</mesh>
      <mesh position={[0.225, 0.08, 0.885]}><boxGeometry args={[2.15, 0.1, 0.03]} />{wall}</mesh>
      {/* RGB strips along the inside edges */}
      <mesh position={[0.225, 0.68, -0.82]}><boxGeometry args={[2.0, 0.015, 0.01]} /><primitive object={RGB_MATS[5]} attach="material" /></mesh>
      <mesh position={[-0.82, 0.68, 0.025]}><boxGeometry args={[0.01, 0.015, 1.6]} /><primitive object={RGB_MATS[5]} attach="material" /></mesh>
      {/* front intake fans on the +x wall */}
      {[-0.55, -0.12].map((z) => (
        <group key={z} position={[1.24, 0.37, z]} rotation-z={Math.PI / 2}>
          <Fan r={0.17} speed={() => S.fan} rgb={0} />
        </group>
      ))}
    </group>
  )
}

function Glass() {
  return (
    <Part k="glass" from={[2.3, 1.05, -0.3]} to={[0.225, 0.715, 0.025]} fromRot={[0, -0.3, 1.15]}>
      <mesh>
        <boxGeometry args={[2.15, 0.01, 1.75]} />
        <meshStandardMaterial color="#a9c3d6" transparent opacity={0.13} metalness={0.9} roughness={0.05} depthWrite={false} />
      </mesh>
    </Part>
  )
}

function Monitor() {
  const screen = useMemo(() => canvasTex(1024, 576, () => {}), [])
  const last = useRef(-1)
  const lines = useMemo(() => [
    'PART-OF-ME BIOS · POST',
    `CPU ........ ${person.name}`,
    `MEMORY ..... ${languages.map((l) => l.name).join(' / ')}`,
    'GPU ........ AI/ML',
    `STORAGE .... ${N_SSD} projects mounted`,
    `POWER ...... ${sap.title}`,
    '',
    ui.bootDone,
  ], [])
  useFrame(() => {
    const n = S.boot <= 0 ? -1 : Math.min(lines.length, Math.ceil(S.boot * lines.length))
    if (n === last.current) return
    last.current = n
    const { g, tex } = screen
    g.fillStyle = n < 0 ? '#050608' : '#03110a'
    g.fillRect(0, 0, 1024, 576)
    g.fillStyle = ACCENT
    g.shadowColor = ACCENT
    g.shadowBlur = 10
    for (let k = 0; k < n; k++) {
      const isLast = k === lines.length - 1
      g.font = isLast ? '700 52px "JetBrains Mono", monospace' : '400 28px "JetBrains Mono", monospace'
      g.fillText(lines[k], 50, isLast ? 500 : 70 + k * 44)
    }
    g.shadowBlur = 0
    tex.needsUpdate = true
  })
  return (
    <group position={[0.2, 0, -2.0]}>
      <mesh position={[0, 0.02, 0]}><boxGeometry args={[0.7, 0.04, 0.35]} /><meshStandardMaterial color="#1a1d24" metalness={0.5} roughness={0.4} /></mesh>
      <mesh position={[0, 0.35, -0.05]}><boxGeometry args={[0.1, 0.65, 0.06]} /><meshStandardMaterial color="#1a1d24" metalness={0.5} roughness={0.4} /></mesh>
      <mesh position={[0, 1.15, 0]}><boxGeometry args={[2.3, 1.32, 0.06]} /><meshStandardMaterial color="#111318" metalness={0.4} roughness={0.4} /></mesh>
      <mesh position={[0, 1.15, 0.031]}>
        <planeGeometry args={[2.2, 1.24]} />
        <meshBasicMaterial map={screen.tex} toneMapped={false} />
      </mesh>
    </group>
  )
}

// ---------- camera, lights, RGB ----------
function CameraRig() {
  const tgt = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, viewport }) => {
    // Pull the camera back on narrow screens so the board and parts still fit
    const a = viewport.aspect
    const pull = a < 1 ? 1 + (1 - a) * 2.0 : a < 1.3 ? 1 + (1.3 - a) * 0.5 : 1
    tgt.set(S.tgtX, S.tgtY, S.tgtZ)
    camera.position.set(tgt.x + (S.camX - tgt.x) * pull, tgt.y + (S.camY - tgt.y) * pull, tgt.z + (S.camZ - tgt.z) * pull)
    camera.lookAt(tgt)
  })
  return null
}

function RgbDriver() {
  const a = useRef<THREE.PointLight>(null)
  const b = useRef<THREE.PointLight>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    RGB_MATS.forEach((m, i) => {
      HUE.setHSL((t * 0.08 + i * 0.14) % 1, 0.9, 0.55)
      m.color.copy(DARK).lerp(HUE, S.rgb)
    })
    if (a.current) { a.current.color.setHSL((t * 0.08) % 1, 0.9, 0.55); a.current.intensity = S.rgb * 1.6 }
    if (b.current) { b.current.color.setHSL((t * 0.08 + 0.4) % 1, 0.9, 0.55); b.current.intensity = S.rgb * 1.6 }
  })
  return (
    <>
      <pointLight ref={a} position={[-0.3, 0.55, -0.4]} distance={2.5} decay={2} intensity={0} />
      <pointLight ref={b} position={[0.9, 0.55, 0.3]} distance={2.5} decay={2} intensity={0} />
    </>
  )
}

function Lights({ shadows }: { shadows: boolean }) {
  const spot = useRef<THREE.SpotLight>(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  useFrame(() => {
    // the warm spotlight follows whatever the camera looks at
    spot.current?.position.set(S.tgtX + 0.6, 5.5, S.tgtZ + 1.6)
    target.position.set(S.tgtX, 0.2, S.tgtZ)
    target.updateMatrixWorld()
  })
  return (
    <>
      <ambientLight intensity={0.08} color="#9fb2ff" />
      <primitive object={target} />
      <spotLight
        ref={spot} target={target} color="#ffd3a1" intensity={70} angle={0.5} penumbra={0.8}
        decay={2} distance={14} castShadow={shadows} shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004}
      />
      <directionalLight position={[-3, 3, -6]} intensity={0.9} color="#7f9cff" />
      {/* procedural reflections, no HDRI download */}
      <Environment resolution={128} frames={1} environmentIntensity={0.4}>
        <Lightformer form="rect" intensity={3} color="#ffe0bd" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[8, 4, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#7f9cff" position={[-6, 2, -4]} scale={[4, 2, 1]} />
        <Lightformer form="ring" intensity={0.8} color="#ffffff" position={[6, 2, 5]} scale={2} />
      </Environment>
    </>
  )
}

function useWoodTexture() {
  return useMemo(() => {
    const { tex } = canvasTex(1024, 256, (g) => {
      g.fillStyle = '#6e4a2e'
      g.fillRect(0, 0, 1024, 256)
      for (let i = 0; i < 140; i++) {
        const y = Math.random() * 256
        g.strokeStyle = `rgba(${40 + Math.random() * 40},${22 + Math.random() * 20},10,${0.15 + Math.random() * 0.25})`
        g.lineWidth = 0.5 + Math.random() * 2
        g.beginPath()
        g.moveTo(0, y)
        for (let x = 0; x <= 1024; x += 64) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 3)
        g.stroke()
      }
    })
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(2, 1)
    return tex
  }, [])
}

export default function Scene({ name, touch, active, onHover, onPick, onReady }: {
  name: string; touch: boolean; active: string | null
  onHover: (k: string | null) => void; onPick: (k: string | null) => void; onReady: () => void
}) {
  const wood = useWoodTexture()
  useEffect(() => {
    const id = requestAnimationFrame(() => onReady())
    return () => cancelAnimationFrame(id)
  }, [onReady])

  return (
    <>
      <color attach="background" args={['#0a0e19']} />
      <fog attach="fog" args={['#0a0e19', 5, 13]} />
      <CameraRig />
      <Lights shadows={!touch} />
      <RgbDriver />
      {/* desk: top at y = 0 */}
      <mesh position={[0.2, -0.06, -0.4]} receiveShadow>
        <boxGeometry args={[9, 0.12, 5.4]} />
        <meshStandardMaterial map={wood} roughness={0.55} />
      </mesh>
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
    </>
  )
}
