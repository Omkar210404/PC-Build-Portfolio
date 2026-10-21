import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import Scene, { buildTimeline, sectionAt, type Section } from './Scene'
import Overlay from './Overlay'
import Simple from './Simple'
import { person, visitorName } from './content'

function webglAvailable() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

// Checks the resume really exists (the dev server answers missing files with index.html)
function useResumeAvailable() {
  const [ok, setOk] = useState(false)
  useEffect(() => {
    fetch(person.resume, { method: 'HEAD' })
      .then((r) => setOk(r.ok && (r.headers.get('content-type') ?? '').includes('pdf')))
      .catch(() => setOk(false))
  }, [])
  return ok
}

export default function App() {
  const name = useMemo(visitorName, [])
  const canWebGL = useMemo(webglAvailable, [])
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const touch = useMemo(() => window.matchMedia('(pointer: coarse)').matches, [])
  const [simple, setSimple] = useState(!canWebGL || reduced)
  const hasResume = useResumeAvailable()

  if (simple) {
    return <Simple hasResume={hasResume} canView3d={canWebGL} onView3d={() => setSimple(false)} />
  }
  return <Experience name={name} touch={touch} hasResume={hasResume} onSkip={() => setSimple(true)} />
}

function Experience({ name, touch, hasResume, onSkip }: {
  name: string; touch: boolean; hasResume: boolean; onSkip: () => void
}) {
  const track = useRef<HTMLDivElement>(null)
  const rail = useRef<HTMLDivElement>(null)
  const lenisRef = useRef<Lenis | null>(null)
  const [section, setSection] = useState<Section>('hook')
  const [fontsReady, setFontsReady] = useState(false)
  const [sceneReady, setSceneReady] = useState(false)
  const [active, setActive] = useState<number | null>(null)
  const closeTimer = useRef<number | undefined>(undefined)

  // Canvas textures need the self-hosted fonts loaded first (with a timeout fallback)
  useEffect(() => {
    const load = Promise.all([
      document.fonts.load('700 48px "JetBrains Mono"'),
      document.fonts.load('400 48px "JetBrains Mono"'),
      document.fonts.load('600 48px Inter'),
      document.fonts.load('800 48px Inter'),
    ])
    Promise.race([load, new Promise((r) => setTimeout(r, 2500))]).then(() => setFontsReady(true))
  }, [])

  // Lenis smooth scroll wired into GSAP's ticker + ScrollTrigger, and the master timeline
  useLayoutEffect(() => {
    if (!track.current) return
    window.scrollTo(0, 0)
    const lenis = new Lenis({ lerp: 0.09 })
    lenisRef.current = lenis
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    let last: Section = 'hook'
    const tl = buildTimeline(track.current, (time, progress) => {
      if (rail.current) rail.current.style.transform = `scaleX(${progress})`
      const s = sectionAt(time)
      if (s !== last) {
        last = s
        setSection(s)
        setActive(null)
      }
    })
    return () => {
      tl.scrollTrigger?.kill()
      tl.kill()
      gsap.ticker.remove(tick)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  // Escape closes the project panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setActive(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Hover opens instantly; leaving closes after a short delay so the panel link can be reached
  const onHover = useCallback((i: number | null) => {
    window.clearTimeout(closeTimer.current)
    if (i === null) closeTimer.current = window.setTimeout(() => setActive(null), 350)
    else setActive(i)
  }, [])
  const keepOpen = useCallback(() => window.clearTimeout(closeTimer.current), [])
  const onReady = useCallback(() => setSceneReady(true), [])
  const scrollToEnd = useCallback(() => {
    const end = document.documentElement.scrollHeight
    if (lenisRef.current) lenisRef.current.scrollTo(end, { duration: 2.5 })
    else window.scrollTo(0, end)
  }, [])

  return (
    <>
      <div className="stage">
        {fontsReady && (
          <Canvas
            shadows={!touch}
            dpr={[1, touch ? 1.5 : 1.75]} // clamp pixel ratio
            gl={{ antialias: !touch, powerPreference: 'high-performance' }}
            camera={{ fov: 40, near: 0.1, far: 40, position: [0, 1, 3.2] }}
            onPointerMissed={() => setActive(null)}
          >
            <Scene name={name} touch={touch} active={active} onHover={onHover} onPick={setActive} onReady={onReady} />
          </Canvas>
        )}
      </div>
      <div className="vignette" />
      <div ref={track} className="track" />
      <Overlay
        name={name}
        section={section}
        active={active}
        setActive={setActive}
        keepOpen={keepOpen}
        onLeavePanel={() => onHover(null)}
        hasResume={hasResume}
        loading={!sceneReady}
        railRef={rail}
        onSkip={onSkip}
        onContact={scrollToEnd}
      />
    </>
  )
}
