// Real 3D models (Sketchfab, CC BY; see README credits) with safe fallbacks to the primitives.
import { Component, useMemo, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { S } from './Parts'

export type ModelCfg = {
  url: string
  rot: [number, number] // radians: x first, then y (applied before fitting)
  fit: { axis: 'x' | 'y' | 'z'; size: number } // scale so this axis (after rotation) has this size
  offset: [number, number, number] // nudge after normalising, in local units
}

// draco off (it would load a decoder from a CDN); meshopt decoder is bundled via three-stdlib
export const preloadModels = (cfgs: ModelCfg[]) => cfgs.forEach((c) => useGLTF.preload(c.url, false, true))

// Model -> fallback primitive if the file is missing or fails to parse, so the site never breaks
export class ModelOr extends Component<{ name: string; fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(e: unknown) { console.warn(`[models] ${this.props.name} could not be loaded; using the primitive instead.`, e) }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

// Dev-only: print mesh names, materials and bounding boxes (used to find fans, LEDs and slots)
function logModel(name: string, root: THREE.Object3D) {
  if (!import.meta.env.DEV) return
  root.updateMatrixWorld(true)
  const rows: Record<string, string>[] = []
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const b = new THREE.Box3().setFromObject(m)
    const f = (v: THREE.Vector3) => v.toArray().map((n) => n.toFixed(3)).join(', ')
    rows.push({ node: m.name, parent: m.parent?.name ?? '', material: (m.material as THREE.Material).name, min: f(b.min), max: f(b.max) })
  })
  console.groupCollapsed(`[models] ${name}: ${rows.length} meshes`)
  console.table(rows)
  console.groupEnd()
}

// Keep the model's own PBR materials; fix blend-mode exports, colour space and anisotropy
function prepareMaterials(root: THREE.Object3D, anisotropy: number) {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.castShadow = true
    m.receiveShadow = true
    for (const mat of [m.material].flat() as THREE.MeshStandardMaterial[]) {
      if (mat.transparent && mat.opacity >= 0.99) { mat.transparent = false; mat.alphaTest = 0.5; mat.depthWrite = true } // Sketchfab exports BLEND everywhere
      for (const t of [mat.map, mat.emissiveMap]) if (t) t.colorSpace = THREE.SRGBColorSpace
      for (const t of [mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap, mat.emissiveMap]) if (t) t.anisotropy = anisotropy
      mat.envMapIntensity = 1.1
      mat.needsUpdate = true
    }
  })
}

// Rotate, fit to size, and put the anchor (default: bbox bottom centre) at the local origin
function normalise(model: THREE.Object3D, cfg: ModelCfg, anchorBox?: (b: THREE.Box3) => THREE.Vector3) {
  const inner = new THREE.Group()
  inner.rotation.x = cfg.rot[0]
  inner.add(model)
  const outer = new THREE.Group()
  outer.rotation.y = cfg.rot[1]
  outer.add(inner)
  const wrap = new THREE.Group()
  wrap.add(outer)
  wrap.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(outer)
  const s = cfg.fit.size / box.getSize(new THREE.Vector3())[cfg.fit.axis]
  const anchor = anchorBox ? anchorBox(box) : new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2)
  outer.scale.setScalar(s)
  outer.position.copy(anchor.multiplyScalar(-s)).add(new THREE.Vector3(...cfg.offset))
  return wrap
}

// ---------- motherboard ----------
export function MotherboardModel({ cfg, position, anisotropy }: { cfg: ModelCfg; position: [number, number, number]; anisotropy: number }) {
  const { scene } = useGLTF(cfg.url, false, true)
  const obj = useMemo(() => {
    logModel('motherboard', scene)
    prepareMaterials(scene, anisotropy)
    return normalise(scene, cfg)
  }, [scene, cfg, anisotropy])
  return <primitive object={obj} position={position} />
}

// ---------- GPU: collapses its exploded layers on install, spins its three fans, pulses its lit front ----------
export function GpuModel({ cfg, anisotropy }: { cfg: ModelCfg; anisotropy: number }) {
  const { scene } = useGLTF(cfg.url, false, true)
  const rig = useMemo(() => {
    logModel('gpu', scene)
    prepareMaterials(scene, anisotropy)
    scene.updateMatrixWorld(true)
    // Layers by material: Front (shroud + fans), Back (backplate), the rest = PCB.
    // The model ships them ~8 units apart along z; we slide them together as S.gpu goes 0 -> 1.
    const meshes: THREE.Mesh[] = []
    scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh) })
    const layerOf = (m: THREE.Mesh) => (m.material as THREE.Material).name
    const boxOf = (list: THREE.Object3D[]) => list.reduce((b, o) => b.union(new THREE.Box3().setFromObject(o)), new THREE.Box3())
    const front = meshes.filter((m) => layerOf(m) === 'Front')
    const back = meshes.filter((m) => layerOf(m) === 'Back')
    const pcb = meshes.filter((m) => layerOf(m) !== 'Front' && layerOf(m) !== 'Back')
    const pcbBox = boxOf(pcb)
    const frontDz = front.length ? pcbBox.max.z - boxOf(front).min.z : 0
    const backDz = back.length ? pcbBox.min.z - boxOf(back).max.z : 0

    // Fans: round front meshes about a third of the card long, thin along z. Wrap each in a pivot at its centre.
    const cardLen = boxOf(meshes).getSize(new THREE.Vector3()).x
    const fans: { pivot: THREE.Object3D; axis: THREE.Vector3 }[] = []
    const movers: { obj: THREE.Object3D; base: THREE.Vector3; delta: THREE.Vector3 }[] = []
    const localDelta = (parent: THREE.Object3D, dz: number) => {
      const q = parent.getWorldQuaternion(new THREE.Quaternion()).invert()
      return new THREE.Vector3(0, 0, dz).applyQuaternion(q)
    }
    for (const m of front) {
      const size = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3())
      const round = Math.abs(size.x - size.y) < 0.15 * size.x && size.x > cardLen * 0.2 && size.z < 0.4 * size.x
      let obj: THREE.Object3D = m
      if (round && m.parent) {
        const center = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3())
        const pivot = new THREE.Object3D()
        pivot.position.copy(m.parent.worldToLocal(center))
        m.parent.add(pivot)
        pivot.updateMatrixWorld(true)
        pivot.attach(m)
        fans.push({ pivot, axis: new THREE.Vector3(0, 0, 1).applyQuaternion(pivot.getWorldQuaternion(new THREE.Quaternion()).invert()) })
        obj = pivot
      }
      movers.push({ obj, base: obj.position.clone(), delta: localDelta(obj.parent!, frontDz) })
    }
    for (const m of back) movers.push({ obj: m, base: m.position.clone(), delta: localDelta(m.parent!, backDz) })
    if (import.meta.env.DEV) console.info(`[models] gpu: ${fans.length} fans found, layers collapse by ${frontDz.toFixed(2)} / ${backDz.toFixed(2)}`)

    // The lit front (emissive texture) gets its own material clone so we can pulse it
    const lit = front.find((m) => (m.material as THREE.MeshStandardMaterial).emissiveMap)
    const glowMat = lit ? (lit.material as THREE.MeshStandardMaterial).clone() : null
    if (glowMat) front.forEach((m) => { if ((m.material as THREE.Material).name === 'Front') m.material = glowMat })

    // Normalise in the collapsed state; anchor = bottom of the PCB layer (gold fingers), centred on the card
    const apply = (k: number) => movers.forEach(({ obj, base, delta }) => obj.position.copy(base).addScaledVector(delta, k))
    apply(1)
    const wrap = normalise(scene, cfg, (box) => {
      scene.updateMatrixWorld(true)
      const p = boxOf(pcb)
      return new THREE.Vector3((box.min.x + box.max.x) / 2, p.min.y, (p.min.z + p.max.z) / 2)
    })
    apply(0)
    return { wrap, fans, apply, glowMat }
  }, [scene, cfg, anisotropy])

  useFrame(({ clock }, dt) => {
    rig.apply(Math.min(1, Math.max(0, S.gpu))) // exploded while hovering, assembled when installed
    const speed = Math.max(S.gpuFan, S.fan) * dt * 25
    rig.fans.forEach(({ pivot, axis }) => pivot.rotateOnAxis(axis, speed))
    if (rig.glowMat) rig.glowMat.emissiveIntensity = 0.7 + 0.3 * Math.sin(clock.elapsedTime * 2) + S.rgb * 1.8
  })
  return <primitive object={rig.wrap} />
}

// ---------- RAM: one model, cloned per stick ----------
export function RamModel({ cfg, anisotropy }: { cfg: ModelCfg; anisotropy: number }) {
  const { scene } = useGLTF(cfg.url, false, true)
  const base = useMemo(() => {
    logModel('ram', scene)
    prepareMaterials(scene, anisotropy)
    return scene
  }, [scene, anisotropy])
  const obj = useMemo(() => normalise(base.clone(true), cfg), [base, cfg])
  return <primitive object={obj} />
}
