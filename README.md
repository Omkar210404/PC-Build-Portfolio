# Recruiter Workspace Delivery

A scroll-driven, real-time 3D portfolio for Omkar Satish Nikam. Scroll is the timeline: a CRT monitor greets the visitor, a cardboard box opens to reveal the resume and project folders, then gets packed, labelled and stamped with a contact slip.

## Run

```bash
npm install
npm run dev      # http://localhost:5173  (try ?for=Your%20Name)
npm run build    # production build in dist/
```

## Edit

- **Text and links:** `src/content.ts` (projects list, captions, contact details).
- **Resume:** drop `public/resume.pdf`; the download buttons hide when it is missing.
- **Scroll timing:** the `HOOK` / `DELIVERY` / `UNBOX` / `DWELL` / `CHECKOUT` constants at the top of `src/Scene.tsx`; overall scroll length is `.track` in `src/styles.css`.

A plain HTML version (`src/Simple.tsx`) is used when WebGL is unavailable, when reduced motion is set, or after clicking **Skip 3D**.

## Credits

Built with [three.js](https://threejs.org), [React Three Fiber](https://github.com/pmndrs/react-three-fiber) and [drei](https://github.com/pmndrs/drei), [GSAP](https://gsap.com) + ScrollTrigger, [Lenis](https://lenis.darkroom.engineering), [Vite](https://vite.dev). Fonts: Inter and JetBrains Mono (SIL OFL), self-hosted via [Fontsource](https://fontsource.org).

## License

MIT
