# Every part of this machine is a part of me

An interactive, scroll-driven 3D portfolio. A PC assembles itself in real time as you scroll, and each component stands for a part of my profile. Scroll back and it comes apart again.

Built by **Omkar Satish Nikam**, Computer Engineering graduate (University of Mumbai, 2026), working in AI/ML, Python and SAP MM.

[GitHub](https://github.com/Omkar210404) · [LinkedIn](https://www.linkedin.com/in/omkar-nikam-6431282b4/) · omkarnikamofficial21@gmail.com

## The story

| Scroll beat | Part | What it shows |
|---|---|---|
| Hook | Exploded parts above a bare board | A POST display types `Hi, <name>` (from `?for=Name`) |
| 1 | CPU drops into the socket, cooler mounts | Who I am |
| 2 | Four RAM sticks click into their slots | Languages: Python, SQL, TypeScript, JavaScript |
| 3 | GPU slides into the PCIe slot, fans spin up | AI/ML focus |
| 4 | M.2 SSDs mount, one per project | Projects (hover or tap a drive for details) |
| 5 | PSU cables snap in, energy flows, the board lights up | SAP S/4HANA experience and internship |
| 6 | Glass panel, RGB on, monitor boots | "System online. Hire me." and a contact form |

## Features

- Real-time 3D (not a video): React Three Fiber scene scrubbed by one GSAP ScrollTrigger timeline, with Lenis smooth scrolling
- Real PBR models for the motherboard, GPU and RAM, with automatic fallback to built-in primitives if a model fails to load
- Per-section colour script, light shafts, drifting dust, blueprint grid, snap-in shockwaves and sparks
- Scroll-speed reactive camera, glow and dust streaks
- Desktop postprocessing: bloom, light depth of field, ACES tone mapping, vignette and film grain (skipped on touch devices)
- Project panels on hover or tap, plus keyboard-friendly buttons
- Contact form that opens your email app (no backend)
- Plain HTML version for no-WebGL devices, `prefers-reduced-motion`, or the **Skip 3D** button
- Mobile framing, clamped pixel ratio, self-hosted fonts, no runtime CDNs

## Tech stack

Vite · React 19 · TypeScript · three.js · @react-three/fiber · @react-three/drei · @react-three/postprocessing · GSAP ScrollTrigger · Lenis · glTF Transform

## Getting started

Requires Node.js 20.19+ or 22.12+ (Vite 8).

```bash
npm install
npm run dev      # http://localhost:5173  (try ?for=Your%20Name)
npm run build    # production build in dist/
npm run preview  # serve the production build
```

The build uses relative paths, so `dist/` can be hosted from any static host or sub-path (for example GitHub Pages).

## Project structure

```
src/
  content.ts     all text and links
  Scene.tsx      scroll timeline, camera shots, colours, model config (TUNING block at the top)
  Parts.tsx      PC parts, board layout, snap-in effects
  Models.tsx     3D model loading, normalising and fallbacks
  Background.tsx grid, dust, light shafts, glows, desk
  Overlay.tsx    captions, dock, project panel, contact form, credits
  Simple.tsx     plain HTML version
public/models/   optimised .glb models + models.json (credits metadata)
scripts/         fetch-models.mjs (finds, downloads and optimises the models)
```

## Customise

- **Text and links:** `src/content.ts`
- **Resume:** add `public/resume.pdf`; the download buttons stay hidden until it exists
- **Scroll length, beat timing, camera shots, colours, model scale/rotation:** the TUNING block at the top of `src/Scene.tsx`
- **Slot positions on the board:** top of `src/Parts.tsx`

## 3D models

The motherboard, GPU and RAM come from Sketchfab. To fetch them again, put `SKETCHFAB_TOKEN=...` in `.env.local` (git-ignored) and run `node scripts/fetch-models.mjs` (`--search` only lists candidates). The script accepts only CC0 or CC Attribution models, validates each download, and optimises it with glTF Transform.

## Credits

3D models (CC BY 4.0 requires attribution):

- **Motherboard:** [X570 Prime motherboard [HQ PBR]](https://sketchfab.com/3d-models/x570-prime-motherboard-hq-pbr-25b3659935774b1e9d73d8954be065d8) by [Igor.Jop](https://sketchfab.com/Igor.Jop), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Changes: optimised (meshopt geometry, WebP textures at 1024 px), scaled and placed in the scene.
- **GPU:** [MSI RTX 3080 Graphics card](https://sketchfab.com/3d-models/msi-rtx-3080-graphics-card-e5c384afae914d548a591f722e1878fc) by [Kaif.3D](https://sketchfab.com/kaif.3d), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Changes: optimised, scaled, front and back layers slid together on install, fans animated, emissive pulse.
- **RAM:** [Crucial BALLISTIX 8GB DDR4 3600 RAM | Black](https://sketchfab.com/3d-models/crucial-ballistix-8gb-ddr4-3600-ram-black-1fce4935471e46cab6ee57ba140c87f9) by [BlackCube](https://sketchfab.com/blackcube4), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Changes: optimised, scaled, stood upright and reused for all four sticks.

Libraries: [three.js](https://threejs.org), [React Three Fiber](https://github.com/pmndrs/react-three-fiber), [drei](https://github.com/pmndrs/drei), [postprocessing](https://github.com/pmndrs/postprocessing), [GSAP](https://gsap.com), [Lenis](https://lenis.darkroom.engineering), [Vite](https://vite.dev), [glTF Transform](https://gltf-transform.dev). Fonts: Inter and JetBrains Mono (SIL OFL), self-hosted via [Fontsource](https://fontsource.org). The CPU, cooler, SSDs, PSU, cables, case and background are built from primitives, small shaders and canvas-generated textures.

## License

Code: [MIT](LICENSE). The 3D models keep their own CC BY 4.0 licences (see Credits).
