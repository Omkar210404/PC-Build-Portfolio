// Environment: blueprint grid, drifting dust, velocity streaks, light shafts, back glow, glossy desk.
// Colours follow GLOW (the per-section colour script in Scene.tsx). All cheap shaders, no postprocessing.
import { useMemo } from 'react'
import { useFrame, type ThreeElements } from '@react-three/fiber'
import * as THREE from 'three'
import { GLOW, V, canvasTex } from './Parts'

const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false } as const
const VERT_UV = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'

// Faint perspective blueprint grid on a back wall and a floor far below the desk
function Grid({ axis, ...props }: { axis: 'xy' | 'xz' } & ThreeElements['mesh']) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `
      uniform vec3 uColor; varying vec3 vW;
      float grid(vec2 p, float s) { vec2 g = abs(fract(p / s - 0.5) - 0.5) / fwidth(p / s); return 1.0 - min(min(g.x, g.y), 1.0); }
      void main() {
        vec2 p = ${axis === 'xy' ? 'vW.xy' : 'vW.xz'};
        float l = grid(p, 0.5) * 0.35 + grid(p, 2.5) * 0.8;
        float fade = 1.0 - smoothstep(2.0, 13.0, length(p - vec2(0.3, ${axis === 'xy' ? '1.0' : '0.0'})));
        gl_FragColor = vec4(uColor * l * fade * 0.22, 1.0);
      }`,
    ...additive,
  }), [axis])
  useFrame(() => mat.uniforms.uColor.value.set('#3a64d8').lerp(GLOW, 0.35))
  return <mesh material={mat} {...props}><planeGeometry args={[40, 30]} /></mesh>
}

// Slow-drifting dust (one Points draw call, motion in the vertex shader)
function Dust({ count }: { count: number }) {
  const { geo, mat } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos.set([-5 + Math.random() * 11, Math.random() * 4.5, -4 + Math.random() * 8], i * 3)
      seed[i] = Math.random()
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color() }, uOpacity: { value: 0.5 }, uScale: { value: 40 } },
      vertexShader: `
        attribute float aSeed; uniform float uTime; uniform float uScale; varying float vA;
        void main() {
          vec3 p = position;
          p.y = mod(p.y + uTime * (0.03 + aSeed * 0.05), 4.5) - 0.3;
          p.x += sin(uTime * 0.2 + aSeed * 20.0) * 0.15;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uScale * (0.4 + aSeed) / -mv.z;
          vA = 0.25 + 0.75 * aSeed;
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uOpacity; varying float vA;
        void main() { float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)); gl_FragColor = vec4(uColor, a * vA * uOpacity); }`,
      ...additive,
    })
    return { geo, mat }
  }, [count])
  useFrame(({ clock, gl }) => {
    mat.uniforms.uTime.value = clock.elapsedTime
    mat.uniforms.uScale.value = 40 * gl.getPixelRatio()
    mat.uniforms.uOpacity.value = 0.45 + V.s * 0.5
    mat.uniforms.uColor.value.set('#ffe6c8').lerp(GLOW, 0.4)
  })
  return <points geometry={geo} material={mat} />
}

// Fast dust streaks that only appear while scrolling quickly
function Streaks({ count }: { count: number }) {
  const { geo, mat } = useMemo(() => {
    const pos = new Float32Array(count * 6)
    const end = new Float32Array(count * 2)
    const seed = new Float32Array(count * 2)
    for (let i = 0; i < count; i++) {
      const p = [-4 + Math.random() * 9, Math.random() * 4.5, -3 + Math.random() * 6]
      pos.set([...p, ...p], i * 6)
      end.set([0, 1], i * 2)
      const s = Math.random()
      seed.set([s, s], i * 2)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uVel: { value: 0 }, uColor: { value: new THREE.Color() } },
      vertexShader: `
        attribute float aEnd; attribute float aSeed; uniform float uTime; uniform float uVel; varying float vE;
        void main() {
          vec3 p = position;
          p.y = mod(p.y + uTime * (0.4 + aSeed), 4.5) - 0.3;
          p.y += aEnd * uVel * (0.6 + aSeed * 1.2);
          vE = aEnd;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: 'uniform vec3 uColor; uniform float uVel; varying float vE; void main(){ gl_FragColor = vec4(uColor, uVel * 0.9 * (1.0 - vE)); }',
      ...additive,
    })
    return { geo, mat }
  }, [count])
  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.elapsedTime
    mat.uniforms.uVel.value = V.s
    mat.uniforms.uColor.value.set('#ffffff').lerp(GLOW, 0.5)
  })
  return <lineSegments geometry={geo} material={mat} />
}

// Soft volumetric light shafts: open cones, bright at the top, fading down and at the edges
function Shafts() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color() }, uI: { value: 0.07 } },
    vertexShader: `
      varying vec2 vUv; varying float vF;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vF = pow(abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz))), 2.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: 'uniform vec3 uColor; uniform float uI; varying vec2 vUv; varying float vF; void main(){ gl_FragColor = vec4(uColor * smoothstep(0.0, 0.7, vUv.y) * vF * uI, 1.0); }',
    side: THREE.DoubleSide, ...additive,
  }), [])
  useFrame(() => {
    mat.uniforms.uColor.value.set('#ffd3a1').lerp(GLOW, 0.45)
    mat.uniforms.uI.value = 0.07 + V.s * 0.05
  })
  return (
    <group>
      {[[-0.5, 0.15], [0.5, -0.05], [1.4, -0.2]].map(([x, tilt], i) => (
        <mesh key={i} material={mat} position={[x, 2.7, -0.2 + i * 0.15]} rotation={[0.12, 0, tilt]}>
          <cylinderGeometry args={[0.15, 0.9 + i * 0.15, 5.2, 24, 1, true]} />
        </mesh>
      ))}
    </group>
  )
}

// Big soft glow behind the build, plus a faint spill on the glossy desk (fake reflection)
function Glows() {
  const make = (power: number) => new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color() }, uI: { value: 0.5 } },
    vertexShader: VERT_UV,
    fragmentShader: `uniform vec3 uColor; uniform float uI; varying vec2 vUv;
      void main(){ float a = pow(1.0 - smoothstep(0.0, 0.5, length(vUv - 0.5)), ${power.toFixed(1)}); gl_FragColor = vec4(uColor * a * uI, 1.0); }`,
    ...additive,
  })
  const back = useMemo(() => make(1.8), [])
  const spill = useMemo(() => make(2.2), [])
  useFrame(() => {
    back.uniforms.uColor.value.copy(GLOW)
    back.uniforms.uI.value = 0.42 + V.s * 0.35 // glow boost while scrolling fast
    spill.uniforms.uColor.value.copy(GLOW)
    spill.uniforms.uI.value = 0.22 + V.s * 0.15
  })
  return (
    <>
      <mesh material={back} position={[0.3, 1.3, -3.6]}><planeGeometry args={[14, 8]} /></mesh>
      <mesh material={spill} position={[0.25, 0.004, 0.1]} rotation-x={-Math.PI / 2}><planeGeometry args={[5.5, 4.2]} /></mesh>
    </>
  )
}

// Dark glossy desk: darkened wood grain, low roughness so the procedural env reflects in it
function Desk() {
  const wood = useMemo(() => {
    const { tex } = canvasTex(1024, 256, (g) => {
      g.fillStyle = '#2a1d14'
      g.fillRect(0, 0, 1024, 256)
      for (let i = 0; i < 140; i++) {
        const y = Math.random() * 256
        g.strokeStyle = `rgba(${20 + Math.random() * 30},${12 + Math.random() * 14},6,${0.2 + Math.random() * 0.3})`
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
  return (
    <mesh position={[0.2, -0.06, -0.4]} receiveShadow>
      <boxGeometry args={[9, 0.12, 5.4]} />
      <meshStandardMaterial map={wood} roughness={0.22} metalness={0.25} envMapIntensity={1.4} />
    </mesh>
  )
}

export default function Background({ touch }: { touch: boolean }) {
  return (
    <>
      <color attach="background" args={['#070b16']} />
      <fog attach="fog" args={['#070b16', 6, 16]} />
      <Grid axis="xy" position={[0.3, 2, -5]} />
      <Grid axis="xz" position={[0.3, -1.2, -1]} rotation-x={-Math.PI / 2} />
      <Glows />
      <Shafts />
      <Dust count={touch ? 160 : 650} />
      <Streaks count={touch ? 30 : 110} />
      <Desk />
    </>
  )
}
