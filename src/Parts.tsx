// PC parts (primitives + wrappers that hold the 3D models), shared per-frame state, and snap-in impacts.
import { useMemo, useRef, type ReactNode } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { aiml, languages, person, projects, sap, ui } from './content'

// ---------- layout (world units; desk top y = 0, PCB top y = B) ----------
// The board footprint and every slot position below were measured on public/models/motherboard.glb
// (X570 Prime) and mapped with BOARD: model scaled by BOARD.scale, model +Y -> world -Z, bbox centre at x/z.
// The primitive fallback board uses the same numbers, so parts land on their slots either way.
export const BOARD = { x: -0.2, z: -0.05, w: 1.166, d: 1.452, scale: 0.45 }
export const B = 0.1
export const SOCKET = { x: -0.292, z: -0.325, seat: 0.135, w: 0.265, d: 0.222 }
export const RAM_X = [0.131, 0.181, 0.226, 0.273]
export const RAM_Z = -0.339
export const RAM_H = 0.18 // stick height (the RAM model is scaled to this)
export const RAM_SEAT = 0.128 // stick bottom, connector sunk into the slot
export const PCIE = { x: -0.299, z: 0.09, top: 0.162, len: 0.548 }
export const GPU_SIZE = { len: 1.2, h: 0.48, t: 0.2 } // the GPU model is scaled to len
export const ATX24 = { x: 0.361, z: -0.262, top: 0.18 }
export const EPS8 = { x: -0.49, z: -0.753, top: 0.174 }
export const N_SSD = Math.min(projects.length, 6)
const SSD_COLS = N_SSD <= 3 ? N_SSD : Math.ceil(N_SSD / 2)
export const SSD_Y = 0.175 // drives rest on top of the lower slots
export const ssdSlot = (i: number) => ({ x: -0.6 + (i % SSD_COLS) * 0.4, z: 0.36 + Math.floor(i / SSD_COLS) * 0.17 })
export const PSU = { x: 1.0, y: 0.22, z: 0.5 }

// Power cables: PSU -> connector. The last point of each curve is the connector.
const CABLES = [
  [[0.84, 0.36, 0.32], [0.72, 0.42, 0.0], [0.5, 0.32, -0.26], [ATX24.x + 0.01, ATX24.top + 0.02, ATX24.z]], // 24-pin ATX
  [[0.92, 0.36, 0.3], [1.08, 0.42, -0.2], [0.9, 0.45, -0.78], [-0.1, 0.45, -0.8], [EPS8.x, 0.3, -0.8], [EPS8.x, EPS8.top + 0.02, EPS8.z]], // CPU 8-pin
  [[0.82, 0.36, 0.45], [0.75, 0.78, 0.3], [0.5, 0.8, 0.12], [0.36, GPU_SIZE.h + 0.17, PCIE.z]], // GPU PCIe
].map((pts) => new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z))))

// Shared per-frame state. GSAP writes it (scrubbed by scroll), useFrame reads it directly.
// Part keys go 0 (exploded, hovering) -> 1 (installed). fx_* keys drive snap-in impacts.
export const S: Record<string, number> = {
  t: 0, camX: 1.1, camY: 2.4, camZ: 3.8, tgtX: 0.55, tgtY: 0.85, tgtZ: 0,
  cpu: 0, plate: 0, lever: 0, cooler: 0, gpu: 0, gpuFan: 0, psu: 0, psuFan: 0, gauge: 0,
  energy: 0, wave: 0, glass: 0, rgb: 0, fan: 0, boot: 0,
  ram0: 0, ram1: 0, ram2: 0, ram3: 0, c0: 0, c1: 0, c2: 0,
}
for (let i = 0; i < N_SSD; i++) S[`ssd${i}`] = 0

// Scroll velocity from Lenis (raw) and a smoothed 0..1 version for decorative effects only
export const V = { vel: 0, s: 0 }

// Section colour, written every frame by the colour script in Scene.tsx
export const GLOW = new THREE.Color('#3a5cff')
export const ACCENT = '#39ff88'
const WHITE = new THREE.Color('#ffffff')

// Snap-in impacts: ring shockwave + flash + sparks at each connection point
export const IMPACTS: { k: string; pos: number[]; size: number }[] = [
  { k: 'fx_cpu', pos: [SOCKET.x, SOCKET.seat + 0.03, SOCKET.z], size: 0.22 },
  { k: 'fx_cooler', pos: [SOCKET.x, SOCKET.seat + 0.25, SOCKET.z], size: 0.22 },
  ...RAM_X.map((x, i) => ({ k: `fx_ram${i}`, pos: [x, RAM_SEAT + RAM_H, RAM_Z], size: 0.18 })),
  { k: 'fx_gpu', pos: [0, GPU_SIZE.h + 0.16, PCIE.z], size: 0.45 },
  ...Array.from({ length: N_SSD }, (_, i) => ({ k: `fx_ssd${i}`, pos: [ssdSlot(i).x, SSD_Y + 0.01, ssdSlot(i).z], size: 0.22 })),
  { k: 'fx_psu', pos: [PSU.x, PSU.y + 0.18, PSU.z], size: 0.3 },
  ...CABLES.map((c, i) => ({ k: `fx_c${i}`, pos: c.points[c.points.length - 1].toArray(), size: 0.2 })),
  { k: 'fx_glass', pos: [0.225, 0.72, 0.025], size: 1.1 },
]
IMPACTS.forEach(({ k }) => (S[k] = 0))

// ---------- helpers ----------
export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
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
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const VERT_UV = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'

// RGB materials: dark until S.rgb, then cycle hues (driven in RgbDriver)
const RGB_MATS = Array.from({ length: 6 }, () => new THREE.MeshBasicMaterial({ color: '#111318', toneMapped: false }))
const DARK = new THREE.Color('#111318')
const HUE = new THREE.Color()
const LED_MAT = new THREE.MeshBasicMaterial({ color: ACCENT, toneMapped: false })

// Puts decorative objects on layer 1 (seen by the main camera, ignored by contact shadows)
export function FxLayer({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = ref.current
    if (g && !g.userData.fx) { g.traverse((o) => o.layers.set(1)); g.userData.fx = true }
  })
  return <group ref={ref}>{children}</group>
}

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
    const p = S[k] // applied directly, no smoothing
    const free = Math.max(0, 1 - p)
    const bob = Math.sin(state.clock.elapsedTime * 1.1 + seed * 1.7) * 0.03 * free // idle float while exploded
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
        <torusGeometry args={[r, r * 0.08, 8, 32]} />
        {rgb !== undefined ? <primitive object={RGB_MATS[rgb]} attach="material" /> : <meshStandardMaterial color="#1b1e25" />}
      </mesh>
      <group ref={blades}>
        <mesh>
          <cylinderGeometry args={[r * 0.28, r * 0.28, r * 0.2, 20]} />
          <meshStandardMaterial color="#20232b" roughness={0.35} metalness={0.3} />
        </mesh>
        {Array.from({ length: 7 }, (_, i) => (
          <mesh key={i} rotation={[0.35, (i / 7) * Math.PI * 2, 0, 'YXZ']} position={[Math.cos((i / 7) * Math.PI * 2) * r * 0.55, 0, -Math.sin((i / 7) * Math.PI * 2) * r * 0.55]}>
            <boxGeometry args={[r * 0.62, 0.006, r * 0.3]} />
            <meshStandardMaterial color="#2a2e38" roughness={0.45} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// ---------- circuit-trace glow layer (dim at rest; a power-up wave spreads from the power connectors) ----------
const TRACES = Array.from({ length: 420 }, () => {
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1], [-1, 0], [0, -1]]
  let x = Math.round((Math.random() * 1024) / 8) * 8
  let y = Math.round((Math.random() * 1024) / 8) * 8
  const pts = [[x, y]]
  for (let s = 0; s < 3 + Math.random() * 3; s++) {
    const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)]
    const len = 16 + Math.random() * 90
    x += dx * len
    y += dy * len
    pts.push([x, y])
  }
  return { pts, w: Math.random() < 0.2 ? 3 : 1.5, a: 0.4 + Math.random() * 0.6 }
})
const boardUv = (x: number, z: number) => new THREE.Vector2((x - BOARD.x) / BOARD.w + 0.5, 0.5 - (z - BOARD.z) / BOARD.d)

export function TraceGlow({ base, lift }: { base: number; lift: number }) {
  const mat = useMemo(() => {
    const glow = canvasTex(1024, 1024, (g) => {
      g.fillStyle = '#000'
      g.fillRect(0, 0, 1024, 1024)
      for (const t of TRACES) {
        g.strokeStyle = `rgba(255,255,255,${t.a})`
        g.lineWidth = t.w
        g.beginPath()
        t.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
        g.stroke()
        const [x, y] = t.pts[t.pts.length - 1]
        g.fillStyle = '#fff'
        g.beginPath()
        g.arc(x, y, 3.5, 0, Math.PI * 2)
        g.fill()
      }
    }).tex
    glow.colorSpace = THREE.NoColorSpace
    return new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: glow }, uWave: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color() },
        uBase: { value: new THREE.Color('#2f8a6a').multiplyScalar(base) },
        uC1: { value: boardUv(ATX24.x, ATX24.z) }, uC2: { value: boardUv(EPS8.x, EPS8.z) },
      },
      vertexShader: VERT_UV,
      fragmentShader: `
        uniform sampler2D uMap; uniform float uWave; uniform float uTime; uniform vec3 uColor; uniform vec3 uBase;
        uniform vec2 uC1; uniform vec2 uC2; varying vec2 vUv;
        void main() {
          float tr = texture2D(uMap, vUv).r;
          float d = min(distance(vUv, uC1), distance(vUv, uC2));
          float on = step(0.001, uWave);
          float front = uWave * 1.4;
          float lit = smoothstep(front, front - 0.15, d) * on;
          float band = exp(-pow((d - front) * 12.0, 2.0)) * on * (1.0 - smoothstep(0.85, 1.0, uWave));
          float shimmer = 0.85 + 0.15 * sin(uTime * 2.0 - d * 25.0);
          vec3 col = uBase * tr + uColor * tr * (lit * 0.55 * shimmer + band * 2.2);
          gl_FragColor = vec4(col, 1.0);
        }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    })
  }, [base])
  useFrame(({ clock }) => {
    mat.uniforms.uWave.value = S.wave
    mat.uniforms.uTime.value = clock.elapsedTime
    mat.uniforms.uColor.value.copy(GLOW)
  })
  return (
    <FxLayer>
      <mesh position={[BOARD.x, B + lift, BOARD.z]} rotation-x={-Math.PI / 2} material={mat}>
        <planeGeometry args={[BOARD.w, BOARD.d]} />
      </mesh>
    </FxLayer>
  )
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
  // a small POST display card standing at the top-right corner of the board
  return (
    <group position={[0.24, B, -0.74]} rotation-x={-0.5}>
      <RoundedBox args={[0.34, 0.16, 0.025]} radius={0.006} position={[0, 0.09, 0]}>
        <meshStandardMaterial color="#14171d" roughness={0.35} metalness={0.4} />
      </RoundedBox>
      <mesh position={[0, 0.09, 0.0131]}>
        <planeGeometry args={[0.31, 0.12]} />
        <meshBasicMaterial map={screen.tex} toneMapped={false} />
      </mesh>
    </group>
  )
}

// Always-present board details (model or primitive): POST display, LEDs, CPU lever, M.2 standoffs
export function BoardExtras({ name }: { name: string }) {
  const lever = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (lever.current) lever.current.rotation.x = 1.1 * (1 - S.lever)
    // status LEDs pulse all the time; they take the section colour once powered
    const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 3))
    LED_MAT.color.set(ACCENT).lerp(GLOW, S.wave).multiplyScalar(pulse * 2)
  })
  return (
    <group>
      <DebugDisplay name={name} />
      {[[ATX24.x - 0.06, ATX24.z + 0.16], [ATX24.x - 0.06, ATX24.z + 0.2], [ATX24.x - 0.06, ATX24.z + 0.24], [-0.7, 0.6], [0.3, 0.6]].map(([x, z], i) => (
        <mesh key={i} position={[x, B + 0.008, z]} material={LED_MAT}><boxGeometry args={[0.014, 0.01, 0.014]} /></mesh>
      ))}
      <group ref={lever} position={[SOCKET.x + SOCKET.w / 2 + 0.01, SOCKET.seat, SOCKET.z + SOCKET.d / 2]}>
        <mesh position={[0, 0, -0.11]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.006, 0.006, 0.22, 8]} />
          <meshStandardMaterial color="#c9ccd2" metalness={0.9} roughness={0.25} />
        </mesh>
      </group>
    </group>
  )
}

// Primitive motherboard (fallback when motherboard.glb is missing), laid out on the measured slots
export function BoardPrimitive() {
  const base = useMemo(() => canvasTex(512, 640, (g) => {
    g.fillStyle = '#0c1a1f'
    g.fillRect(0, 0, 512, 640)
    g.fillStyle = 'rgba(230,230,220,0.5)'
    g.font = '600 16px "JetBrains Mono", monospace'
    g.fillText('PART-OF-ME  REV 1.0', 24, 620)
  }).tex, [])
  const plate = useRef<THREE.Group>(null)
  useFrame(() => { if (plate.current) plate.current.rotation.x = -1.9 * (1 - S.plate) })
  const metal = <meshStandardMaterial color="#2b2f38" metalness={0.7} roughness={0.35} />
  const slot = <meshStandardMaterial color="#1a1c22" roughness={0.6} />
  return (
    <group>
      <RoundedBox args={[BOARD.w, 0.03, BOARD.d]} radius={0.006} position={[BOARD.x, B - 0.015, BOARD.z]} receiveShadow>
        <meshStandardMaterial map={base} roughness={0.5} />
      </RoundedBox>
      <RoundedBox args={[0.5, 0.08, 0.1]} radius={0.01} position={[SOCKET.x, B + 0.04, SOCKET.z - 0.2]} castShadow>{metal}</RoundedBox>
      <RoundedBox args={[0.1, 0.08, 0.42]} radius={0.01} position={[SOCKET.x - 0.24, B + 0.04, SOCKET.z]} castShadow>{metal}</RoundedBox>
      <RoundedBox args={[0.1, 0.16, 0.6]} radius={0.01} position={[BOARD.x - BOARD.w / 2 + 0.06, B + 0.08, -0.35]} castShadow>{metal}</RoundedBox>
      <mesh position={[SOCKET.x, B + 0.017, SOCKET.z]}>
        <boxGeometry args={[SOCKET.w * 0.8, 0.034, SOCKET.d * 0.9]} />
        <meshStandardMaterial color="#c2a46c" metalness={0.6} roughness={0.4} />
      </mesh>
      <group ref={plate} position={[SOCKET.x, SOCKET.seat - 0.005, SOCKET.z - 0.1]}>
        {[[0, 0.01, 0.2, 0.02], [0, 0.19, 0.2, 0.02], [-0.09, 0.1, 0.02, 0.2], [0.09, 0.1, 0.02, 0.2]].map(([x, z, w, d], i) => (
          <mesh key={i} position={[x, 0, z]}><boxGeometry args={[w, 0.01, d]} />{metal}</mesh>
        ))}
      </group>
      {RAM_X.map((x) => <mesh key={x} position={[x, B + 0.032, RAM_Z]}><boxGeometry args={[0.03, 0.064, 0.675]} />{slot}</mesh>)}
      {[PCIE.z, 0.372, 0.557].map((z) => <mesh key={z} position={[PCIE.x, B + 0.031, z]}><boxGeometry args={[PCIE.len, 0.062, 0.04]} />{slot}</mesh>)}
      <mesh position={[ATX24.x, B + 0.04, ATX24.z]}><boxGeometry args={[0.05, 0.08, 0.24]} /><meshStandardMaterial color="#e8e8e2" roughness={0.6} /></mesh>
      <mesh position={[EPS8.x, B + 0.035, EPS8.z]}><boxGeometry args={[0.1, 0.07, 0.05]} /><meshStandardMaterial color="#e8e8e2" roughness={0.6} /></mesh>
      <TraceGlow base={0.32} lift={0.001} />
    </group>
  )
}

// ---------- CPU + cooler (refined primitives) ----------
export function Cpu() {
  const ihs = useMemo(() => canvasTex(256, 256, (g) => {
    const grad = g.createLinearGradient(0, 0, 256, 256)
    grad.addColorStop(0, '#c9ccd2')
    grad.addColorStop(1, '#9fa4ac')
    g.fillStyle = grad
    g.fillRect(0, 0, 256, 256)
    g.fillStyle = 'rgba(40,44,52,0.85)'
    g.font = '700 24px "JetBrains Mono", monospace'
    g.fillText('O. S. NIKAM', 30, 110)
    g.font = '400 17px "JetBrains Mono", monospace'
    g.fillText('COMP. ENGG · 2026', 30, 142)
  }).tex, [])
  return (
    <Part k="cpu" from={[SOCKET.x, 1.35, -0.15]} to={[SOCKET.x, SOCKET.seat, SOCKET.z]} fromRot={[0.5, 0.3, 0]} seed={1}>
      <RoundedBox args={[0.19, 0.012, 0.19]} radius={0.003} position={[0, 0.006, 0]}><meshStandardMaterial color="#1f5a3a" roughness={0.55} /></RoundedBox>
      <RoundedBox args={[0.15, 0.016, 0.15]} radius={0.006} position={[0, 0.02, 0]} castShadow>
        <meshStandardMaterial color="#c4c7cd" metalness={0.9} roughness={0.28} />
      </RoundedBox>
      <mesh position={[0, 0.0285, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[0.135, 0.135]} /><meshStandardMaterial map={ihs} metalness={0.75} roughness={0.32} /></mesh>
    </Part>
  )
}

export function Cooler() {
  const copper = <meshStandardMaterial color="#b87333" metalness={0.9} roughness={0.28} />
  return (
    <Part k="cooler" from={[-0.95, 1.55, -0.95]} to={[SOCKET.x, SOCKET.seat + 0.03, SOCKET.z]} fromRot={[0.35, 0.6, 0.1]} seed={2}>
      <RoundedBox args={[0.16, 0.022, 0.16]} radius={0.005} position={[0, 0.011, 0]}>{copper}</RoundedBox>
      {/* heat pipes rising through the fin stack */}
      {[-0.05, 0, 0.05].map((x) => (
        <mesh key={x} position={[x, 0.1, 0]}><cylinderGeometry args={[0.009, 0.009, 0.18, 10]} />{copper}</mesh>
      ))}
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} position={[0, 0.045 + i * 0.014, 0]} castShadow={i === 9}>
          <boxGeometry args={[0.26, 0.004, 0.26]} />
          <meshStandardMaterial color="#c8ccd3" metalness={0.85} roughness={0.32} />
        </mesh>
      ))}
      <RoundedBox args={[0.27, 0.012, 0.27]} radius={0.004} position={[0, 0.19, 0]}><meshStandardMaterial color="#15181e" metalness={0.5} roughness={0.4} /></RoundedBox>
      <group position={[0, 0.205, 0]}>
        <Fan r={0.115} speed={() => 0.15 + S.fan} rgb={0} />
      </group>
    </Part>
  )
}

// ---------- hover helpers for RAM + SSDs ----------
export type StickProps = { i: number; active: boolean; onHover: (k: string | null) => void; onPick: (k: string | null) => void }

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

// ---------- RAM: wrapper with label + light bar; the body is the RAM model or RamBodyPrimitive ----------
// Body origin = bottom centre, long axis along z, height RAM_H.
export function RamBodyPrimitive() {
  return (
    <group>
      <mesh position={[0, 0.05, 0]} castShadow><boxGeometry args={[0.012, 0.1, 0.6]} /><meshStandardMaterial color="#1d4a33" /></mesh>
      <RoundedBox args={[0.026, RAM_H - 0.03, 0.6]} radius={0.004} position={[0, 0.03 + (RAM_H - 0.03) / 2, 0]}>
        <meshStandardMaterial color="#1b1e25" metalness={0.7} roughness={0.32} />
      </RoundedBox>
    </group>
  )
}

export function RamStick({ i, active, onHover, onPick, body }: StickProps & { body: ReactNode }) {
  const lang = languages[i]
  const label = useMemo(() => canvasTex(512, 40, (g) => {
    g.fillStyle = '#0f1218'
    g.fillRect(0, 0, 512, 40)
    g.fillStyle = ACCENT
    g.font = '700 30px "JetBrains Mono", monospace'
    g.fillText(lang.name.toUpperCase(), 12, 30)
  }).tex, [lang.name])
  const key = `ram-${i}`
  return (
    <Part
      k={`ram${i}`} from={[0.15 + i * 0.17, 1.12 + i * 0.06, -0.6 + i * 0.03]} to={[RAM_X[i], RAM_SEAT, RAM_Z]}
      fromRot={[0.2, 0.3, 0.35]} seed={3 + i} {...hoverEvents(key, `ram${i}`, onHover, onPick)}
    >
      <group position-y={active ? 0.025 : 0}>
        {body}
        <mesh position={[0, RAM_H + 0.003, 0.02]}><boxGeometry args={[0.03, 0.006, 0.5]} /><primitive object={RGB_MATS[1 + (i % 2)]} attach="material" /></mesh>
        <group position={[0, RAM_H + 0.0065, -0.02]} rotation-y={Math.PI / 2}>
          <mesh rotation-x={-Math.PI / 2}>
            <planeGeometry args={[0.42, 0.032]} />
            <meshBasicMaterial map={label} toneMapped={false} color={active ? '#ffffff' : '#cfd6d2'} />
          </mesh>
        </group>
      </group>
    </Part>
  )
}

// ---------- GPU: wrapper; the body is the GPU model or GpuBodyPrimitive ----------
// Body origin = bottom centre of the card's PCB edge, long axis x (bracket at -x), fans facing +z.
export function GpuBodyPrimitive() {
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
  const { len: W, h: H, t: T } = GPU_SIZE
  const speed = () => Math.max(S.gpuFan, S.fan)
  return (
    <group>
      <RoundedBox args={[W, H, T]} radius={0.02} position={[0, H / 2, T * 0.25]} castShadow>
        <meshStandardMaterial color="#23272f" metalness={0.55} roughness={0.38} />
      </RoundedBox>
      <mesh position={[-W / 2 - 0.01, H / 2 - 0.05, 0]}><boxGeometry args={[0.02, H + 0.1, T + 0.04]} /><meshStandardMaterial color="#9aa0aa" metalness={0.9} roughness={0.3} /></mesh>
      <mesh position={[0, H + 0.0015, T * 0.25]} rotation-x={-Math.PI / 2}><planeGeometry args={[0.6, 0.075]} /><meshBasicMaterial map={top} toneMapped={false} /></mesh>
      <mesh position={[0.4, H + 0.003, T * 0.25]}><boxGeometry args={[0.2, 0.004, 0.06]} /><primitive object={RGB_MATS[3]} attach="material" /></mesh>
      {[-0.36, 0, 0.36].map((x) => (
        <group key={x} position={[x, H / 2, T * 0.75 + 0.005]} rotation-x={Math.PI / 2}>
          <Fan r={0.16} speed={speed} rgb={4} />
        </group>
      ))}
    </group>
  )
}

export function Gpu({ body }: { body: ReactNode }) {
  return (
    <Part k="gpu" from={[-0.3, 1.0, 0.65]} to={[0, PCIE.top - 0.03, PCIE.z]} fromRot={[0.15, 0.25, 0.05]} seed={7}>
      {body}
    </Part>
  )
}

// ---------- SSDs (one per project; refined primitives) ----------
export function Ssd({ i, active, onHover, onPick }: StickProps) {
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
      to={[s.x, SSD_Y, s.z]} fromRot={[0.55, -0.3, 0.1]} seed={9 + i}
      {...hoverEvents(key, `ssd${i}`, onHover, onPick)}
    >
      <group position-y={active ? 0.03 : 0}>
        <RoundedBox args={[0.38, 0.01, 0.11]} radius={0.003}><meshStandardMaterial color="#123526" roughness={0.5} /></RoundedBox>
        {/* gold edge connector, controller + NAND chips under the label */}
        <mesh position={[-0.186, 0.001, 0]}><boxGeometry args={[0.012, 0.011, 0.09]} /><meshStandardMaterial color="#d4af37" metalness={1} roughness={0.25} /></mesh>
        {[-0.1, 0.02, 0.12].map((x) => (
          <mesh key={x} position={[x, 0.007, 0]}><boxGeometry args={[0.08, 0.004, 0.08]} /><meshStandardMaterial color="#111317" roughness={0.4} /></mesh>
        ))}
        <mesh position={[0, 0.0098, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.34, 0.085]} />
          <meshStandardMaterial map={label} roughness={0.65} emissive={active ? ACCENT : '#000000'} emissiveIntensity={active ? 0.25 : 0} />
        </mesh>
      </group>
    </Part>
  )
}

// ---------- PSU (fan + power gauge ring) and cables with energy pulses ----------
export function Psu() {
  const gauge = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uFill: { value: 0 }, uColor: { value: new THREE.Color() } },
    vertexShader: VERT_UV,
    fragmentShader: `
      uniform float uFill; uniform vec3 uColor; varying vec2 vUv;
      void main() {
        vec2 c = vUv - 0.5;
        float a = fract(atan(c.x, -c.y) / 6.28318 + 0.5); // 0..1 clockwise from the front
        float on = step(a, uFill);
        gl_FragColor = vec4(mix(vec3(0.06, 0.07, 0.09), uColor * 1.8, on), 0.35 + on * 0.65);
      }`,
    transparent: true, toneMapped: false,
  }), [])
  const sticker = useMemo(() => canvasTex(256, 128, (g) => {
    g.fillStyle = '#c9ccd2'
    g.fillRect(0, 0, 256, 128)
    g.fillStyle = '#1b2233'
    g.font = '700 26px "JetBrains Mono", monospace'
    g.fillText('PSU · SAP', 20, 50)
    g.font = '400 14px "JetBrains Mono", monospace'
    g.fillText(sap.title.toUpperCase(), 20, 84)
  }).tex, [])
  useFrame(() => {
    gauge.uniforms.uFill.value = S.gauge
    gauge.uniforms.uColor.value.copy(GLOW)
  })
  return (
    <Part k="psu" from={[1.7, 0.85, 0.8]} to={[PSU.x, PSU.y, PSU.z]} fromRot={[0.2, -0.45, 0.12]} seed={14}>
      <RoundedBox args={[0.4, 0.34, 0.6]} radius={0.02} castShadow>
        <meshStandardMaterial color="#1a1d23" metalness={0.65} roughness={0.35} />
      </RoundedBox>
      <mesh position={[0.2011, 0, 0.05]} rotation-y={Math.PI / 2}><planeGeometry args={[0.32, 0.16]} /><meshStandardMaterial map={sticker} roughness={0.5} metalness={0.3} /></mesh>
      {/* modular ports on the cable side */}
      {[-0.18, -0.1, -0.02].map((z) => (
        <mesh key={z} position={[-0.201, 0.08, z]}><boxGeometry args={[0.004, 0.05, 0.06]} /><meshStandardMaterial color="#0b0c0f" /></mesh>
      ))}
      <group position={[0, 0.172, 0.05]}>
        <Fan r={0.14} speed={() => 0.04 + S.psuFan + S.fan} />
      </group>
      <mesh position={[0, 0.176, 0.05]} rotation-x={-Math.PI / 2} material={gauge}>
        <ringGeometry args={[0.155, 0.178, 64]} />
      </mesh>
    </Part>
  )
}

function useEnergyMaterial() {
  return useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uOffset: { value: 0 }, uOn: { value: 0 }, uColor: { value: new THREE.Color() } },
    vertexShader: VERT_UV,
    fragmentShader: `
      uniform float uOffset; uniform float uOn; uniform vec3 uColor; varying vec2 vUv;
      void main() {
        float d = fract(vUv.x * 7.0 - uOffset);           // vUv.x runs PSU -> connector
        float pulse = smoothstep(0.0, 0.1, d) * smoothstep(0.4, 0.1, d);
        float a = (0.12 + pulse * 1.4) * uOn;
        gl_FragColor = vec4(uColor * a * 1.6, a);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }), [])
}

// sleeved-cable look: fine diagonal braid in the colour map
const SLEEVE = (() => {
  const { tex } = canvasTex(64, 16, (g) => {
    g.fillStyle = '#16181d'
    g.fillRect(0, 0, 64, 16)
    g.strokeStyle = '#2a2e36'
    g.lineWidth = 2
    for (let x = -16; x < 64; x += 6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 16, 16); g.stroke() }
  })
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(60, 1)
  return tex
})()

export function Cable({ i }: { i: number }) {
  const r = i === 0 ? 0.028 : 0.018
  const geo = useMemo(() => new THREE.TubeGeometry(CABLES[i], 64, r, 8), [i, r])
  const glowGeo = useMemo(() => new THREE.TubeGeometry(CABLES[i], 64, r * 1.3, 8), [i, r])
  const energy = useEnergyMaterial()
  const plug = useRef<THREE.Mesh>(null)
  const end = useMemo(() => CABLES[i].getTangentAt(1), [i])
  const total = geo.index!.count
  useFrame(({ clock }) => {
    const c = S[`c${i}`] // can overshoot past 1 (back.out) for the snap
    const p = clamp01(c)
    const n = Math.floor((total * p) / 48) * 48 // 48 indices per tube segment (8 radial * 6)
    geo.setDrawRange(0, n)
    glowGeo.setDrawRange(0, n)
    if (plug.current) {
      plug.current.visible = p > 0.01
      plug.current.position.copy(CABLES[i].getPointAt(p)).addScaledVector(end, Math.max(0, c - 1) * 0.8)
    }
    const connected = clamp01((c - 0.97) / 0.03)
    energy.uniforms.uOn.value = connected * (0.3 + 0.7 * S.energy)
    energy.uniforms.uOffset.value = S.energy * 6 + clock.elapsedTime * 0.6 * connected // pulses travel toward the board
    energy.uniforms.uColor.value.copy(GLOW)
  })
  return (
    <>
      <mesh geometry={geo} castShadow><meshStandardMaterial map={SLEEVE} roughness={0.6} /></mesh>
      <FxLayer><mesh geometry={glowGeo} material={energy} /></FxLayer>
      <RoundedBox ref={plug} args={[i === 0 ? 0.05 : 0.045, 0.045, i === 0 ? 0.2 : 0.06]} radius={0.006}>
        <meshStandardMaterial color="#0d0f12" roughness={0.45} />
      </RoundedBox>
    </>
  )
}

// ---------- snap-in impact: ring shockwave + flash + sparks (all scrubbed by scroll) ----------
const FLASH_TEX = (() => {
  const { tex } = canvasTex(128, 128, (g) => {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
  })
  return tex
})()
const SPARKS = 14

function Impact({ k, pos, size }: { k: string; pos: number[]; size: number }) {
  const group = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const flash = useRef<THREE.Mesh>(null)
  const mats = useMemo(() => ({
    ring: new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    flash: new THREE.MeshBasicMaterial({ map: FLASH_TEX, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    spark: new THREE.PointsMaterial({ size: 0.018, color: '#fff3c4', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  }), [])
  const dirs = useMemo(() => Array.from({ length: SPARKS }, () =>
    new THREE.Vector3(Math.random() - 0.5, 0.4 + Math.random() * 0.8, Math.random() - 0.5).normalize()), [])
  const sparkGeo = useMemo(() => new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3)), [])
  useFrame(() => {
    const f = S[k]
    const on = f > 0.001 && f < 0.999
    if (group.current) group.current.visible = on
    if (!on) return
    ring.current?.scale.setScalar(size * (0.25 + f * 1.6))
    flash.current?.scale.setScalar(size * (0.8 + f * 0.8))
    mats.ring.color.copy(GLOW).lerp(WHITE, 0.35)
    mats.ring.opacity = (1 - f) * 0.9
    mats.flash.color.copy(GLOW).lerp(WHITE, 0.5)
    mats.flash.opacity = Math.pow(1 - f, 3) * 0.9
    mats.spark.opacity = 1 - f
    const a = sparkGeo.attributes.position as THREE.BufferAttribute
    dirs.forEach((d, i) => a.setXYZ(i, d.x * f * size * 1.3, d.y * f * size * 1.3 - f * f * size * 0.7, d.z * f * size * 1.3))
    a.needsUpdate = true
  })
  return (
    <group ref={group} position={pos as [number, number, number]} visible={false}>
      <mesh ref={ring} rotation-x={-Math.PI / 2} material={mats.ring}><ringGeometry args={[0.9, 1, 48]} /></mesh>
      <mesh ref={flash} rotation-x={-Math.PI / 2} material={mats.flash}><planeGeometry args={[1, 1]} /></mesh>
      <points geometry={sparkGeo} material={mats.spark} />
    </group>
  )
}

export function Impacts() {
  return <FxLayer>{IMPACTS.map((p) => <Impact key={p.k} {...p} />)}</FxLayer>
}

// ---------- case (lying on its side), glass panel, monitor, RGB ----------
export function Case() {
  const wall = <meshStandardMaterial color="#14171d" metalness={0.65} roughness={0.38} />
  return (
    <group>
      <RoundedBox args={[2.15, 0.05, 1.75]} radius={0.012} position={[0.225, 0.025, 0.025]} receiveShadow>{wall}</RoundedBox>
      <RoundedBox args={[2.15, 0.7, 0.03]} radius={0.01} position={[0.225, 0.36, -0.84]} receiveShadow>{wall}</RoundedBox>
      <RoundedBox args={[0.03, 0.7, 1.75]} radius={0.01} position={[-0.84, 0.36, 0.025]} receiveShadow>{wall}</RoundedBox>
      <RoundedBox args={[0.03, 0.7, 1.75]} radius={0.01} position={[1.285, 0.36, 0.025]} receiveShadow>{wall}</RoundedBox>
      <RoundedBox args={[2.15, 0.1, 0.03]} radius={0.008} position={[0.225, 0.08, 0.885]}>{wall}</RoundedBox>
      {/* motherboard standoffs */}
      {[[-0.73, -0.72], [0.33, -0.72], [-0.73, 0.6], [0.33, 0.6], [-0.2, -0.05]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.07, z]}><cylinderGeometry args={[0.012, 0.012, 0.04, 8]} /><meshStandardMaterial color="#b89a5a" metalness={0.9} roughness={0.3} /></mesh>
      ))}
      <mesh position={[0.225, 0.68, -0.82]}><boxGeometry args={[2.0, 0.015, 0.01]} /><primitive object={RGB_MATS[5]} attach="material" /></mesh>
      <mesh position={[-0.82, 0.68, 0.025]}><boxGeometry args={[0.01, 0.015, 1.6]} /><primitive object={RGB_MATS[5]} attach="material" /></mesh>
      {[-0.55, -0.12].map((z) => (
        <group key={z} position={[1.24, 0.37, z]} rotation-z={Math.PI / 2}>
          <Fan r={0.17} speed={() => 0.05 + S.fan} rgb={0} />
        </group>
      ))}
    </group>
  )
}

export function Glass() {
  return (
    <Part k="glass" from={[2.3, 1.05, -0.3]} to={[0.225, 0.715, 0.025]} fromRot={[0, -0.3, 1.15]}>
      <mesh>
        <boxGeometry args={[2.15, 0.01, 1.75]} />
        <meshStandardMaterial color="#a9c3d6" transparent opacity={0.14} metalness={0.95} roughness={0.04} depthWrite={false} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(2.15, 0.01, 1.75)]} />
        <lineBasicMaterial color="#cfe3ff" transparent opacity={0.18} />
      </lineSegments>
    </Part>
  )
}

export function Monitor() {
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
      <RoundedBox args={[0.7, 0.04, 0.35]} radius={0.012} position={[0, 0.02, 0]}><meshStandardMaterial color="#1a1d24" metalness={0.6} roughness={0.35} /></RoundedBox>
      <mesh position={[0, 0.35, -0.05]}><boxGeometry args={[0.1, 0.65, 0.06]} /><meshStandardMaterial color="#1a1d24" metalness={0.6} roughness={0.35} /></mesh>
      <RoundedBox args={[2.3, 1.32, 0.06]} radius={0.015} position={[0, 1.15, 0]}><meshStandardMaterial color="#111318" metalness={0.5} roughness={0.35} /></RoundedBox>
      <mesh position={[0, 1.15, 0.031]}>
        <planeGeometry args={[2.2, 1.24]} />
        <meshBasicMaterial map={screen.tex} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function RgbDriver() {
  const a = useRef<THREE.PointLight>(null)
  const b = useRef<THREE.PointLight>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    RGB_MATS.forEach((m, i) => {
      HUE.setHSL((t * 0.08 + i * 0.14) % 1, 0.9, 0.55)
      m.color.copy(DARK).lerp(HUE, S.rgb).multiplyScalar(1 + S.rgb) // > 1 so bloom picks it up
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
