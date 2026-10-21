import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Environment, Lightformer, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { projects, extraFolderColors, person, ui } from './content'

gsap.registerPlugin(ScrollTrigger)

// ---------------------------------------------------------------------------
// SCROLL TIMING. The master timeline runs from 0 to CHECKOUT.end "units";
// the whole scroll track maps onto it. To retime: change these numbers
// (keep them in order). A longer range = more scrolling for that part.
// Scroll length itself is the .track height in styles.css.
// ---------------------------------------------------------------------------
export const HOOK = { start: 0, end: 1 }
export const DELIVERY = { start: 1, end: 4 }
export const UNBOX = { start: 4, end: 6 }
export const DWELL = { start: 6, end: 7 } // everything still so visitors can hover
export const CHECKOUT = { start: 7, end: 10 }
const CONTACT_AT = CHECKOUT.start + 2.2 // when the contact form shows

export type Section = 'hook' | 'delivery' | 'unbox' | 'checkout' | 'contact'
export function sectionAt(t: number): Section {
  if (t < HOOK.end) return 'hook'
  if (t < DELIVERY.end) return 'delivery'
  if (t < DWELL.end) return 'unbox'
  if (t < CONTACT_AT) return 'checkout'
  return 'contact'
}

// Layout positions (world units, desk top is y = 0)
const MONITOR_X = 0
const BOX_X = 5
const BOX = { w: 1.7, h: 0.9, d: 1.2, t: 0.03 }

// Shared per-frame state. GSAP writes it, useFrame reads it. No React re-renders.
const S: Record<string, number> = {
  camX: 0, camY: 1.0, camZ: 3.2, tgtX: 0, tgtY: 0.85, tgtZ: -0.3,
  flap0: 0, flap1: 0, flap2: 0, flap3: 0, // front, back, left, right (0 closed, 1 open)
  sheet: 0, label: 0, stamp: 0, slip: 0,
}
projects.forEach((_, i) => (S[`f${i}`] = 0))

// Builds the master timeline scrubbed by scroll. Called from App.tsx.
export function buildTimeline(track: HTMLElement, onUpdate: (time: number, progress: number) => void) {
  const tl = gsap.timeline({
    defaults: { ease: 'power2.inOut' },
    scrollTrigger: {
      trigger: track, start: 'top top', end: 'bottom bottom', scrub: true,
      onUpdate: (st) => onUpdate(st.progress * CHECKOUT.end, st.progress),
    },
  })
  const D = DELIVERY.start
  // 2. DELIVERY: glide along the desk to the box, open flaps, resume slides out
  tl.to(S, { camX: 2.5, camY: 1.5, camZ: 3.8, tgtX: 2.5, tgtY: 0.6, tgtZ: 0, duration: 0.6, ease: 'power1.in' }, D)
    .to(S, { camX: BOX_X, camY: 2.3, camZ: 3.3, tgtX: BOX_X, tgtY: 0.55, tgtZ: 0, duration: 0.7, ease: 'power1.out' }, D + 0.6)
    .to(S, { flap0: 1, duration: 0.5 }, D + 1.2)
    .to(S, { flap1: 1, duration: 0.5 }, D + 1.35)
    .to(S, { flap2: 1, duration: 0.5 }, D + 1.5)
    .to(S, { flap3: 1, duration: 0.5 }, D + 1.65)
    .to(S, { sheet: 1, duration: 0.8, ease: 'power2.out' }, D + 2.1)
  // 3. UNBOXING: sheet goes back, camera eases back, folders lift one by one
  const U = UNBOX.start
  tl.to(S, { sheet: 0, duration: 0.4, ease: 'power2.in' }, U)
    .to(S, { camY: 1.9, camZ: 4.8, tgtY: 1.45, tgtZ: 0.3, duration: 1 }, U)
  const step = 1.4 / Math.max(projects.length, 1)
  projects.forEach((_, i) => tl.to(S, { [`f${i}`]: 1, duration: 0.6, ease: 'power2.out' }, U + 0.4 + i * step))
  // DWELL: a no-op tween keeps everything still for this range
  tl.to({}, { duration: DWELL.end - DWELL.start }, DWELL.start)
  // 4. CHECKOUT: folders drop, flaps close, label, stamp slam, contact slip
  const C = CHECKOUT.start
  projects.forEach((_, i) => tl.to(S, { [`f${i}`]: 0, duration: 0.5, ease: 'power2.in' }, C + i * 0.08))
  tl.to(S, { camY: 2.8, camZ: 2.9, tgtY: 0.6, tgtZ: 0.2, duration: 0.9 }, C + 0.3)
    .to(S, { flap3: 0, duration: 0.4 }, C + 0.6)
    .to(S, { flap2: 0, duration: 0.4 }, C + 0.7)
    .to(S, { flap1: 0, duration: 0.4 }, C + 0.85)
    .to(S, { flap0: 0, duration: 0.4 }, C + 0.95)
    .to(S, { label: 1, duration: 0.35, ease: 'back.out(2)' }, C + 1.4)
    .to(S, { stamp: 1, duration: 0.3, ease: 'power4.in' }, C + 1.8)
    .to(S, { slip: 1, camY: 2.2, camZ: 3.3, tgtZ: 0.8, duration: 0.8, ease: 'power2.out' }, C + 2.2)
  return tl
}

// ---------- canvas texture helper (uses self-hosted Fontsource fonts) ----------
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  draw(g)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return { tex, g, c }
}

// Wood grain texture for the desk
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
    tex.repeat.set(3, 1)
    return tex
  }, [])
}

// ---------- CRT monitor ----------
function Monitor({ name }: { name: string }) {
  const screen = useMemo(() => canvasTex(1024, 768, () => {}), [])
  const glow = useRef<THREE.PointLight>(null)
  const lastKey = useRef('')
  const start = useRef(performance.now())
  const line = `Hi, ${name}`

  useFrame(() => {
    // Typing is time-based on load; 70 ms per character, then cursor blinks
    const elapsed = performance.now() - start.current - 600
    const chars = Math.max(0, Math.min(line.length, Math.floor(elapsed / 70)))
    const cursorOn = Math.floor(performance.now() / 500) % 2 === 0
    const key = `${chars}-${cursorOn}`
    if (key !== lastKey.current) {
      lastKey.current = key
      const { g, tex } = screen
      g.fillStyle = '#04140b'
      g.fillRect(0, 0, 1024, 768)
      const grad = g.createRadialGradient(512, 384, 50, 512, 384, 620)
      grad.addColorStop(0, 'rgba(57,255,136,0.12)')
      grad.addColorStop(1, 'rgba(0,0,0,0.6)')
      g.fillStyle = grad
      g.fillRect(0, 0, 1024, 768)
      g.fillStyle = '#39ff88'
      g.shadowColor = '#39ff88'
      g.shadowBlur = 18
      // Font size shrinks so long names still fit the screen
      const size = Math.min(84, Math.floor(1450 / (line.length + 2)))
      g.font = `700 ${size}px "JetBrains Mono", monospace`
      const typed = '> ' + line.slice(0, chars)
      g.fillText(typed, 70, 330)
      if (cursorOn) g.fillRect(70 + g.measureText(typed).width + 8, 330 - size * 0.8, size * 0.52, size * 0.95)
      if (chars === line.length) {
        g.font = '400 40px "JetBrains Mono", monospace'
        g.fillText(ui.monitorSub, 74, 440)
      }
      g.shadowBlur = 0
      g.fillStyle = 'rgba(0,0,0,0.28)' // scanlines
      for (let y = 0; y < 768; y += 4) g.fillRect(0, y, 1024, 2)
      tex.needsUpdate = true
    }
    if (glow.current) glow.current.intensity = 2.2 + Math.sin(performance.now() * 0.02) * 0.08
  })

  return (
    <group position={[MONITOR_X, 0, -0.3]}>
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.1, 0.6]} />
        <meshStandardMaterial color="#1a1d24" roughness={0.6} />
      </mesh>
      <RoundedBox args={[1.7, 1.35, 1.3]} radius={0.09} position={[0, 0.78, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#20242d" roughness={0.45} metalness={0.1} />
      </RoundedBox>
      <mesh position={[0, 0.8, 0.651]}>
        <planeGeometry args={[1.42, 1.08]} />
        <meshStandardMaterial color="#0b0d12" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.8, 0.656]}>
        <planeGeometry args={[1.28, 0.96]} />
        <meshBasicMaterial map={screen.tex} toneMapped={false} />
      </mesh>
      <pointLight ref={glow} position={[0, 0.8, 1.1]} color="#39ff88" distance={3} decay={2} />
    </group>
  )
}

// ---------- cardboard box with hinged flaps ----------
const cardboard = { color: '#b48a5e', roughness: 0.92 }

function Flap({ k, pos, size, axis, sign, offset }: {
  k: string; pos: [number, number, number]; size: [number, number, number]
  axis: 'x' | 'z'; sign: 1 | -1; offset: [number, number, number]
}) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    // Open angle ~200 degrees so flaps fold outward and droop a little
    if (g.current) g.current.rotation[axis] = sign * S[k] * Math.PI * 1.1
  })
  return (
    <group ref={g} position={pos}>
      <mesh position={offset} castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial {...cardboard} />
      </mesh>
    </group>
  )
}

function Box() {
  const { w, h, d, t } = BOX
  const sheetRef = useRef<THREE.Group>(null)
  const labelRef = useRef<THREE.Mesh>(null)
  const stampRef = useRef<THREE.Mesh>(null)
  const slipRef = useRef<THREE.Group>(null)

  const sheetTex = useMemo(() => canvasTex(512, 660, (g) => {
    g.fillStyle = '#f4f1ea'
    g.fillRect(0, 0, 512, 660)
    g.fillStyle = '#1b2233'
    g.font = '700 38px Inter, sans-serif'
    g.fillText('RESUME', 40, 80)
    g.font = '600 28px Inter, sans-serif'
    g.fillText(person.name, 40, 130)
    g.fillStyle = '#9aa1ad'
    for (let i = 0; i < 14; i++) g.fillRect(40, 190 + i * 30, 300 + ((i * 97) % 130), 10)
  }).tex, [])

  const labelTex = useMemo(() => canvasTex(640, 400, (g) => {
    g.fillStyle = '#f2ece0'
    g.fillRect(0, 0, 640, 400)
    g.strokeStyle = '#1b2233'
    g.lineWidth = 6
    g.strokeRect(14, 14, 612, 372)
    g.fillStyle = '#1b2233'
    g.font = '700 36px "JetBrains Mono", monospace'
    g.fillText('SHIPPING LABEL', 40, 80)
    g.font = '400 28px "JetBrains Mono", monospace'
    g.fillText(ui.label.from, 40, 160)
    g.fillText(ui.label.to, 40, 215)
    g.fillText(ui.label.note, 40, 270)
    for (let x = 40; x < 600; x += 9) g.fillRect(x, 310, (x * 7) % 5 + 2, 50) // barcode-ish
  }).tex, [])

  const stampTex = useMemo(() => canvasTex(512, 220, (g) => {
    g.strokeStyle = '#d0312d'
    g.fillStyle = '#d0312d'
    g.lineWidth = 14
    g.strokeRect(14, 14, 484, 192)
    g.font = '800 120px Inter, sans-serif'
    g.textAlign = 'center'
    g.fillText(ui.stamp, 256, 158)
  }).tex, [])

  const slipTex = useMemo(() => canvasTex(512, 320, (g) => {
    g.fillStyle = '#efe8d8'
    g.fillRect(0, 0, 512, 320)
    g.fillStyle = '#1b2233'
    g.font = '700 34px "JetBrains Mono", monospace'
    g.fillText('CONTACT SLIP', 32, 60)
    g.fillStyle = '#b9b2a2'
    for (let i = 0; i < 4; i++) g.fillRect(32, 120 + i * 50, 448, 3)
  }).tex, [])

  useFrame(() => {
    const s = sheetRef.current
    if (s) {
      s.visible = S.sheet > 0.001
      s.position.y = 0.3 + S.sheet * 1.0
      s.position.z = S.sheet * 0.35
      s.rotation.x = -S.sheet * 0.35
    }
    const l = labelRef.current
    if (l) {
      l.visible = S.label > 0.001
      l.scale.setScalar(Math.max(0.001, S.label))
    }
    const st = stampRef.current
    if (st) {
      st.visible = S.stamp > 0.001
      st.position.y = h + 0.03 + (1 - S.stamp) * 1.2
      st.scale.setScalar(1 + (1 - S.stamp) * 0.6)
      ;(st.material as THREE.MeshBasicMaterial).opacity = Math.min(1, S.stamp * 2) * 0.92
    }
    const sl = slipRef.current
    if (sl) {
      sl.visible = S.slip > 0.001
      sl.position.set(0, 0.05 + S.slip * 0.9, d / 2 + S.slip * 1.1)
      sl.rotation.x = -Math.PI / 2 + S.slip * 1.1
    }
  })

  return (
    <group position={[BOX_X, 0, 0]}>
      {/* walls and bottom */}
      <mesh position={[0, t / 2, 0]} receiveShadow>
        <boxGeometry args={[w, t, d]} />
        <meshStandardMaterial {...cardboard} />
      </mesh>
      {[[0, h / 2, d / 2 - t / 2, w, h, t], [0, h / 2, -d / 2 + t / 2, w, h, t],
        [-w / 2 + t / 2, h / 2, 0, t, h, d], [w / 2 - t / 2, h / 2, 0, t, h, d]].map(([x, y, z, sx, sy, sz], i) => (
        <mesh key={i} position={[x, y, z]} castShadow receiveShadow>
          <boxGeometry args={[sx, sy, sz]} />
          <meshStandardMaterial {...cardboard} />
        </mesh>
      ))}
      {/* tape strip on the front */}
      <mesh position={[0, h - 0.12, d / 2 + 0.002]}>
        <planeGeometry args={[0.25, 0.24]} />
        <meshStandardMaterial color="#c9a77a" roughness={0.5} />
      </mesh>
      {/* flaps: hinge pivots sit on the rim edges; front/back on top of the side flaps */}
      <Flap k="flap0" pos={[0, h + 0.012, d / 2]} size={[w, 0.012, d / 2]} axis="x" sign={1} offset={[0, 0, -d / 4]} />
      <Flap k="flap1" pos={[0, h + 0.012, -d / 2]} size={[w, 0.012, d / 2]} axis="x" sign={-1} offset={[0, 0, d / 4]} />
      <Flap k="flap2" pos={[-w / 2, h, 0]} size={[w * 0.35, 0.012, d]} axis="z" sign={1} offset={[w * 0.175, 0, 0]} />
      <Flap k="flap3" pos={[w / 2, h, 0]} size={[w * 0.35, 0.012, d]} axis="z" sign={-1} offset={[-w * 0.175, 0, 0]} />

      <group ref={sheetRef}>
        <mesh castShadow>
          <planeGeometry args={[0.62, 0.8]} />
          <meshStandardMaterial map={sheetTex} roughness={0.8} side={THREE.DoubleSide} />
        </mesh>
      </group>

      <mesh ref={labelRef} position={[0.25, h + 0.022, 0.12]} rotation={[-Math.PI / 2, 0, 0.05]}>
        <planeGeometry args={[0.8, 0.5]} />
        <meshStandardMaterial map={labelTex} roughness={0.85} />
      </mesh>
      <mesh ref={stampRef} position={[-0.35, h + 0.03, -0.2]} rotation={[-Math.PI / 2, 0, 0.25]}>
        <planeGeometry args={[0.75, 0.32]} />
        <meshBasicMaterial map={stampTex} transparent toneMapped={false} depthWrite={false} />
      </mesh>

      <group ref={slipRef}>
        <mesh castShadow>
          <planeGeometry args={[0.7, 0.44]} />
          <meshStandardMaterial map={slipTex} roughness={0.85} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}

// ---------- project folders ----------
function Folder({ i, active, onHover, onPick }: {
  i: number; active: boolean
  onHover: (i: number | null) => void; onPick: (i: number | null) => void
}) {
  const p = projects[i]
  const color = p.color || extraFolderColors[i % extraFolderColors.length]
  const ref = useRef<THREE.Group>(null)
  const labelTex = useMemo(() => canvasTex(512, 160, (g) => {
    g.fillStyle = '#f2ece0'
    g.fillRect(0, 0, 512, 160)
    g.fillStyle = '#1b2233'
    g.font = '600 44px Inter, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    let size = 44 // shrink long titles to fit
    while (g.measureText(p.title).width > 470 && size > 20) g.font = `600 ${(size -= 2)}px Inter, sans-serif`
    g.fillText(p.title, 256, 82)
  }).tex, [p.title])

  useFrame((state) => {
    const g = ref.current
    if (!g) return
    const k = S[`f${i}`]
    g.visible = k > 0.001
    const n = projects.length
    // Portrait screens: 2 columns grid; landscape: one gentle arc
    const portrait = state.viewport.aspect < 0.85
    const cols = portrait ? 2 : n
    const col = i % cols
    const row = Math.floor(i / cols)
    const rows = Math.ceil(n / cols)
    const u = col - (cols - 1) / 2
    const spacing = portrait ? 1.0 : Math.min(1.05, 4.4 / n)
    const tx = BOX_X + u * spacing
    const ty = (portrait ? 1.85 + ((rows - 1) / 2 - row) * 0.8 : 1.65 - 0.1 * u * u)
    const tz = 0.45 + (portrait ? 0 : -0.08 * u * u)
    const lift = Math.sin((k * Math.PI) / 2) // rise first...
    const out = k * k // ...then move out
    const bob = Math.sin(state.clock.elapsedTime * 1.3 + i * 1.7) * 0.035 * k
    g.position.set(BOX_X + (tx - BOX_X) * out, 0.38 + (ty - 0.38) * lift + bob, (tz) * out)
    g.rotation.set(-0.08 * k, -u * 0.14 * k, 0)
    const target = active ? 1.08 : 1
    g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, target, 0.15))
  })

  const ready = () => S[`f${i}`] > 0.85
  return (
    <group
      ref={ref}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        if (ready() && e.pointerType === 'mouse') { onHover(i); document.body.style.cursor = 'pointer' }
      }}
      onPointerOut={(e: ThreeEvent<PointerEvent>) => {
        if (e.pointerType === 'mouse') { onHover(null); document.body.style.cursor = '' }
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (ready()) onPick(i) }}
    >
      <mesh position={[0, 0, -0.012]} castShadow>
        <boxGeometry args={[0.9, 0.62, 0.012]} />
        <meshStandardMaterial color={color} roughness={0.75} />
      </mesh>
      <mesh position={[-0.27, 0.34, -0.012]} castShadow>
        <boxGeometry args={[0.3, 0.07, 0.012]} />
        <meshStandardMaterial color={color} roughness={0.75} />
      </mesh>
      <mesh position={[0, -0.035, 0.004]} castShadow>
        <boxGeometry args={[0.9, 0.55, 0.01]} />
        <meshStandardMaterial color={new THREE.Color(color).multiplyScalar(1.08)} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.0, 0.0105]}>
        <planeGeometry args={[0.66, 0.2]} />
        <meshStandardMaterial map={labelTex} roughness={0.8} />
      </mesh>
    </group>
  )
}

// ---------- camera rig (adapts to portrait) ----------
function CameraRig() {
  const tgt = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, viewport }) => {
    // Pull the camera back on narrow screens so everything still fits
    const a = viewport.aspect
    const pull = a < 1 ? 1 + (1 - a) * 1.5 : a < 1.3 ? 1 + (1.3 - a) * 0.4 : 1
    tgt.set(S.tgtX, S.tgtY, S.tgtZ)
    camera.position.set(
      tgt.x + (S.camX - tgt.x) * pull,
      tgt.y + (S.camY - tgt.y) * pull,
      tgt.z + (S.camZ - tgt.z) * pull,
    )
    camera.lookAt(tgt)
  })
  return null
}

// ---------- lights: warm spotlight follows the story ----------
function Lights({ shadows }: { shadows: boolean }) {
  const spot = useRef<THREE.SpotLight>(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  useFrame(() => {
    const s = spot.current
    if (!s) return
    s.position.set(S.tgtX + 0.6, 6, 1.8)
    target.position.set(S.tgtX, 0.4, 0)
    target.updateMatrixWorld()
  })
  return (
    <>
      <ambientLight intensity={0.06} color="#9fb2ff" />
      <primitive object={target} />
      <spotLight
        ref={spot} target={target} color="#ffd3a1" intensity={90} angle={0.42} penumbra={0.75}
        decay={2} distance={14} castShadow={shadows} shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004}
      />
      {/* soft cool rim light from behind */}
      <directionalLight position={[-3, 3, -6]} intensity={0.9} color="#7f9cff" />
      {/* procedural reflections, no HDRI download */}
      <Environment resolution={128} frames={1} environmentIntensity={0.35}>
        <Lightformer form="rect" intensity={3} color="#ffe0bd" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[8, 4, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#7f9cff" position={[-6, 2, -4]} scale={[4, 2, 1]} />
        <Lightformer form="ring" intensity={0.8} color="#ffffff" position={[6, 2, 5]} scale={2} />
      </Environment>
    </>
  )
}

export default function Scene({ name, touch, active, onHover, onPick, onReady }: {
  name: string; touch: boolean; active: number | null
  onHover: (i: number | null) => void; onPick: (i: number | null) => void; onReady: () => void
}) {
  const wood = useWoodTexture()
  useEffect(() => {
    const id = requestAnimationFrame(() => onReady())
    return () => cancelAnimationFrame(id)
  }, [onReady])

  return (
    <>
      <color attach="background" args={['#0a0e19']} />
      <fog attach="fog" args={['#0a0e19', 5.5, 15]} />
      <CameraRig />
      <Lights shadows={!touch} />
      {/* desk: top at y = 0, front edge at z = 1.6 */}
      <mesh position={[2.5, -0.06, 0]} receiveShadow>
        <boxGeometry args={[14, 0.12, 3.2]} />
        <meshStandardMaterial map={wood} roughness={0.55} />
      </mesh>
      <Monitor name={name} />
      <Box />
      {projects.map((_, i) => (
        <Folder key={i} i={i} active={active === i} onHover={onHover} onPick={onPick} />
      ))}
    </>
  )
}
