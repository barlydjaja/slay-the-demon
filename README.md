# The Last Hope

A small blue machine explores a rain-soaked, abandoned kingdom and confronts the Hooded Reaper. A self-contained desktop browser action-adventure built with TypeScript, Three.js, Vite, and Web Audio.

## Run

```bash
npm install
npm run dev
```

Open the printed local URL in a desktop browser. Audio starts after **Begin Journey**. Skip the introduction with Space. The game requires a keyboard, mouse, and hardware-accelerated WebGL 2 or WebGPU.

```bash
npm run build     # Type-check and produce dist/
npm run preview   # Serve the production build locally
npm test          # Headless combat, AI, collision, and level topology tests
```

## Controls

| Input             | Action                                     |
| ----------------- | ------------------------------------------ |
| WASD / arrow keys | Move relative to the camera                |
| Mouse             | Aim while attacking or blocking            |
| Left mouse        | Strike; holding repeats after recovery     |
| Right mouse       | Hold a frontal guard                       |
| Shift             | Sprint; consumes stamina                   |
| Space             | Evade; short invulnerability, stamina cost |
| Escape            | Pause / resume                             |
| F3                | Renderer and gameplay diagnostics          |

Defeat each area's guardians to break the next seal. Fallen enemies restore five health. Reaching the sanctuary after the chapel restores health and sets a checkpoint for the current journey. Death before that sanctuary restarts the journey; death afterward lets you retry the boss. Checkpoints are session-local. Only graphics/audio preferences persist on this device.

The boss bar appears when the Reaper wakes. Amber and crimson floor tells show incoming attacks. Aim your guard toward the attacker; heavy attacks cause a little damage through a successful block. Evade a committed attack, then strike during recovery. The reaper moves faster below half health.

## Architecture

- `src/game`: state orchestration, configuration, input, camera, and substepped circle/AABB collisions.
- `src/player`: robot geometry, procedural animation, movement, guard, attacks, and health.
- `src/enemies`: armor/spider state machines, the Reaper model, four boss attacks, and encounter lifecycle.
- `src/world`: five connected dioramas, material textures, lighting, particle pools, reflections, and water effects.
- `src/audio`: original synthesized ambient score, boss score, and combat foley.
- `src/ui`: loading, title, story, HUD, settings, pause, defeat, and victory screens.

All character and environment assets are original procedural geometry. No external asset services, runtime APIs, or backend are required. Cinzel and Inter are bundled locally under their font packages' Open Font Licenses. The initial path loads WebGL and the game; the WebGPU renderer is a separate dynamic chunk, loaded only when the browser exposes WebGPU.

## Rendering and performance

WebGPU is attempted first on supported browsers, with Three.js's WebGL 2 backend fallback and a conventional WebGLRenderer fallback if initialization fails. See the [Three.js renderer documentation](https://threejs.org/manual/en/webgpurenderer).

The scene uses instanced stone floors, material-based static geometry merging per area, area and frustum culling, shared primitive geometries, four selected torch lights, one shadow-casting directional light, a boss rim light, and pooled particles and rings. Water combines irregular PBR puddles, a small procedural environment map, and translucent character silhouette projections. Reflections are deliberately stylized approximations, not screen-space or full-scene planar reflections. Fog uses depth fog and inexpensive textured planes. Emissive glows replace an expensive bloom pipeline. Texture atlases, GLTF compression, and compressed audio are unnecessary because those file assets are not used.

Settings adjust resolution, shadows, reflections, and particles. Sustained slow frames reduce resolution gradually. 1080p/60 FPS is a target, not a measured guarantee: hardware/browser performance and visual output still need an actual browser playtest. Headless tests verify game logic and traversability, not GPU output or encounter difficulty. First-play duration depends on exploration and combat skill.

## Static deployment

Run `npm run build` and publish `dist/`:

- **Vercel:** Vite preset, build command `npm run build`, output `dist`.
- **Netlify:** included `netlify.toml` supplies the build and publish directory.
- **Cloudflare Pages:** build command `npm run build`, output `dist`.
- **GitHub Pages:** upload `dist/` as a Pages artifact. Vite's relative base supports repository subpaths.
- **Sites:** `.openai/hosting.json` registers the project and selects static `dist/` output.

The project has no server routes or secrets. Use HTTPS in production for WebGPU and fullscreen support. A private Sites preview requires the owner's sign-in; a public portfolio deployment can use any of the static hosts above.
