# Every part of this machine is a part of me

A scroll-driven, real-time 3D portfolio for Omkar Satish Nikam. A PC builds itself as you scroll: the CPU (who I am) drops into its socket, RAM sticks (languages) click in, the GPU (AI/ML focus) slides into its slot, M.2 drives (projects) mount, the PSU (SAP experience) gets cabled, and the machine boots into a BIOS-style contact form. Scrolling back takes it apart again.

## Run

```bash
npm install
npm run dev      # http://localhost:5173  (try ?for=Your%20Name)
npm run build    # production build in dist/
```

## Edit

- **Text and links:** `src/content.ts` (about, languages, AI/ML, projects, SAP, internship, captions).
- **Resume:** drop `public/resume.pdf`; the download buttons hide when it is missing.
- **Scroll, camera, colours:** the TUNING block at the top of `src/Scene.tsx`: `SCROLL_VH` (total scroll length), `BEATS` (scroll share per beat), `SHOTS` (camera per beat) and `COLORS` (glow colour per beat).

A plain HTML version (`src/Simple.tsx`) is used when WebGL is unavailable, when reduced motion is set, or after clicking **Skip 3D**.

## Credits

Built with [three.js](https://threejs.org), [React Three Fiber](https://github.com/pmndrs/react-three-fiber) and [drei](https://github.com/pmndrs/drei), [GSAP](https://gsap.com) + ScrollTrigger, [Lenis](https://lenis.darkroom.engineering), [Vite](https://vite.dev). Fonts: Inter and JetBrains Mono (SIL OFL), self-hosted via [Fontsource](https://fontsource.org). All 3D parts, the background and the effects are built from primitives, small shaders and canvas-generated textures; no model files or postprocessing.

## License

MIT
