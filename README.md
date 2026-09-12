# The Last Hope

A small blue machine explores a rain-soaked, abandoned kingdom, defeats the Hooded Reaper, and discovers a living world beyond its gates. A self-contained desktop browser action-adventure built with TypeScript, Three.js, Vite, and Web Audio.

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

| Input             | Action                                      |
| ----------------- | ------------------------------------------- |
| WASD / arrow keys | Move relative to the camera                 |
| Mouse             | Aim while attacking or blocking             |
| Left mouse        | Strike; holding repeats after recovery      |
| Right mouse       | Hold a frontal guard                        |
| Shift             | Sprint; consumes stamina                    |
| Space             | Evade; short invulnerability, stamina cost  |
| E                 | Talk, advance dialogue, or rest at the well |
| Escape            | Pause / resume / leave dialogue             |
| F3                | Renderer and gameplay diagnostics           |

Defeat each area's guardians to break the next seal. Fallen enemies restore five health. Reaching the sanctuary after the chapel restores health and sets a checkpoint for the current journey. Death before that sanctuary restarts the journey; death afterward lets you retry the boss. Checkpoints are session-local. Only graphics/audio preferences persist on this device.

After the Reaper falls, the gate behind the throne rises and daylight enters the chamber. Walk through it to load **Chapter II: The Greenfields**. The castle and its reflection targets are released before the meadow is built. Elder Rowan greets the robot beneath the tree; use **E** or the Continue button to hear his tale, or Escape to listen later. Follow the sunflowers to **Firstlight Village**, a sanctuary with four cottages, three villagers, a vegetable garden, and a working windmill. Entering the village restores health and establishes the chapter's checkpoint; **E** near the well restores health and stamina again.

Twelve creatures inhabit the meadow: quick briar wolves, thornlings, and durable stone golems with slower, stronger attacks. They retreat when the player enters the village or the elder's clearing. Defeated creatures stay defeated after a retry. Clearing the meadow completes the protection objective and leaves exploration open. Returning to the title preserves this chapter during the current session; **Return to the Greenfields** resumes it. Reloading the browser starts a new journey.

The boss bar appears when the Reaper wakes. Amber and crimson floor tells show incoming attacks. Aim your guard toward the attacker; heavy attacks cause a little damage through a successful block. Evade a committed attack, then strike during recovery. The reaper moves faster below half health.

## Architecture

- `src/game`: state orchestration, configuration, input, camera, and substepped circle/AABB collisions.
- `src/player`: robot geometry, procedural animation, movement, guard, attacks, and health.
- `src/enemies`: castle guardians, three field creature models and combat profiles, the Reaper, and encounter lifecycle.
- `src/world`: five connected castle dioramas, a separate meadow/village map, map resource disposal, lighting, particles, and a shared planar puddle reflection.
- `src/audio`: original synthesized ambient score, boss score, and combat foley.
- `src/ui`: chapter loading, title, elder dialogue, HUD, settings, pause, and defeat screens.

Both environments use original Blender assets: 34 castle models cover the pointed arches, recessed windows, fluted columns, worn floors, furniture, statues, and props; 35 Greenfields assets cover terrain, foliage, buildings, villagers, the elder, and monsters. Editable libraries, authoring scripts, and individual studio renders are in `art/`; see [the Blender asset guide](art/blender/README.md). The robot, castle enemies, and visual effects retain their original procedural geometry. No external asset services, runtime APIs, or backend are required. Cinzel and Inter are bundled locally under their font packages' Open Font Licenses. The initial path loads WebGL and the game; the WebGPU renderer is a separate dynamic chunk, loaded only when the browser exposes WebGPU.

## Rendering and performance

WebGPU is attempted first on supported browsers, with Three.js's WebGL 2 backend fallback and a conventional WebGLRenderer fallback if initialization fails. See the [Three.js renderer documentation](https://threejs.org/manual/en/webgpurenderer).

The castle loads an approximately 2.3 MB GLB library before revealing the scene. It uses instanced Blender flagstones, material-based static geometry merging per area, area and frustum culling, four selected torch lights, one shadow-casting directional light, a boss rim light, and pooled particles and rings. Water combines irregular PBR puddles, a small procedural environment map, and one shared planar reflection of the scene. The reflection camera supplies correct perspective and surface occlusion; puddle geometry masks the result, with a soft shoreline fade, a five-tap blur, and subtle ripple distortion. High/Medium cap the extra render target at 768/384 pixels on its longest side; Low disables that pass. Three.js Reflector handles conventional WebGL and ReflectorNode handles WebGPU and its WebGL backend. Fog uses depth fog and inexpensive textured planes. Emissive glows replace an expensive bloom pipeline.

The Greenfields code and its approximately 4.3 MB GLB library load when the chapter begins. Repeated foliage and props use spatially grouped instances sharing geometry and materials. The map uses frustum culling, distance-limited enemy updates, and a single shadow-casting sun. The exported terrain heightfield keeps characters, camera targets, and effects aligned with the hills. It has no castle rain, torch lights, or reflection pass. Map transitions release outgoing geometries, materials, textures, shadow maps, and reflection targets before building the next scene.

Settings adjust resolution, shadows, reflections, and particles. Sustained slow frames reduce resolution gradually. 1080p/60 FPS remains a target, not a measured guarantee. The rebuilt meadow and village were inspected in the desktop browser; every Blender asset was rendered individually for visual review. Headless tests additionally verify exported mesh attributes and pivots, terrain contact against raycast hits, combat, traversability, gate opening, map loading and disposal, elder dialogue state, safe-zone retreat, and village retries. These checks do not establish cross-device frame rates or encounter difficulty. First-play duration depends on exploration and combat skill.

## Static deployment

Run `npm run build` and publish `dist/`:

- **Vercel:** Vite preset, build command `npm run build`, output `dist`.
- **Netlify:** included `netlify.toml` supplies the build and publish directory.
- **Cloudflare Pages:** build command `npm run build`, output `dist`.
- **GitHub Pages:** upload `dist/` as a Pages artifact. Vite's relative base supports repository subpaths.
- **Sites:** `.openai/hosting.json` registers the project and selects static `dist/` output.

The project has no server routes or secrets. Use HTTPS in production for WebGPU and fullscreen support. A private Sites preview requires the owner's sign-in; a public portfolio deployment can use any of the static hosts above.
