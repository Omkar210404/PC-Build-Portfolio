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
- **Scroll, camera, colours, models:** the TUNING block at the top of `src/Scene.tsx`: `SCROLL_VH` (total scroll length), `BEATS` (scroll share per beat), `SHOTS` (camera per beat), `COLORS` (glow colour per beat) and `MODELS` (scale, rotation, offset per 3D model). Slot positions on the board are in `src/Parts.tsx`.

A plain HTML version (`src/Simple.tsx`) is used when WebGL is unavailable, when reduced motion is set, or after clicking **Skip 3D**.

## 3D models

The motherboard, GPU and RAM are real models from Sketchfab in `public/models/`, loaded with a fallback to the built-in primitives if a file is missing. To re-fetch them, put `SKETCHFAB_TOKEN=...` in `.env.local` (git-ignored) and run `node scripts/fetch-models.mjs` (add `--search` to only list candidates). It accepts only CC0 or CC Attribution models, keeps the metadata in `public/models/models.json`, and optimises with gltf-transform.

## Credits

3D models (CC BY 4.0 requires attribution):

- **motherboard**: [X570 Prime motherboard [HQ PBR]](https://sketchfab.com/3d-models/x570-prime-motherboard-hq-pbr-25b3659935774b1e9d73d8954be065d8) by [Igor.Jop](https://sketchfab.com/Igor.Jop), licensed [CC Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). Changes: optimised (meshopt geometry, WebP textures at 1024 px), scaled and placed in the scene.
- **gpu**: [MSI RTX 3080 Graphics card](https://sketchfab.com/3d-models/msi-rtx-3080-graphics-card-e5c384afae914d548a591f722e1878fc) by [Kaif.3D](https://sketchfab.com/kaif.3d), licensed [CC Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). Changes: optimised (meshopt geometry, WebP textures at 1024 px), scaled, its separated front/back layers slid together on install, fans animated, emissive pulse.
- **ram**: [Crucial BALLISTIX 8GB DDR4 3600 RAM | Black](https://sketchfab.com/3d-models/crucial-ballistix-8gb-ddr4-3600-ram-black-1fce4935471e46cab6ee57ba140c87f9) by [BlackCube](https://sketchfab.com/blackcube4), licensed [CC Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). Changes: optimised (meshopt geometry, WebP textures at 1024 px), scaled, stood upright and reused for all four sticks.

Built with [three.js](https://threejs.org), [React Three Fiber](https://github.com/pmndrs/react-three-fiber) and [drei](https://github.com/pmndrs/drei), [GSAP](https://gsap.com) + ScrollTrigger, [Lenis](https://lenis.darkroom.engineering), [Vite](https://vite.dev). Fonts: Inter and JetBrains Mono (SIL OFL), self-hosted via [Fontsource](https://fontsource.org). Postprocessing via [postprocessing](https://github.com/pmndrs/postprocessing) and [@react-three/postprocessing](https://github.com/pmndrs/react-postprocessing); models optimised with [glTF Transform](https://gltf-transform.dev). The CPU, cooler, SSDs, PSU, cables, case and background are built from primitives, small shaders and canvas-generated textures.

## License

Code: MIT. The 3D models keep their own CC BY 4.0 licences (see Credits).
