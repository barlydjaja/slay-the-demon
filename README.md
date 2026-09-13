# The Last Hope

A small blue machine explores a rain-soaked, abandoned kingdom, defeats the Hooded Reaper, and discovers a living world beyond its gates. A self-contained desktop browser action-adventure built with TypeScript, Three.js, Vite, and Web Audio. The [immersion roadmap](docs/IMMERSION_ROADMAP.md) defines ten ordered expansions; the first two, **A Light to Come Home To** and **Three robot disciplines**, are implemented.

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

| Input             | Action                                           |
| ----------------- | ------------------------------------------------ |
| WASD / arrow keys | Move relative to the camera                      |
| Mouse             | Aim while attacking or blocking                  |
| Left mouse        | Strike; holding repeats after recovery           |
| Right mouse       | Hold a frontal guard                             |
| Shift             | Sprint; consumes stamina                         |
| Space             | Evade; short invulnerability, stamina cost       |
| E                 | Talk, recover a component, or rest at the well   |
| Q                 | Use your equipped discipline ability             |
| J                 | Open / close the field journal; pauses the world |
| Escape            | Pause / resume / leave dialogue                  |
| F3                | Renderer and gameplay diagnostics                |

Defeat each area's guardians to break the next seal. Fallen enemies restore five health. Reaching the sanctuary after the chapel restores health and sets a checkpoint for the current journey. Death before that sanctuary restarts the journey; death afterward lets you retry the boss. Castle checkpoints remain session-local. Reaching the Greenfields starts a local browser save; graphics/audio preferences are stored separately.

After the Reaper falls, the gate behind the throne rises on chains and counterweights, revealing a deep stone passage with cool light shafts and moving ironwork shadows. Walk through it to load **Chapter II: The Greenfields**. The castle and its reflection targets are released before the meadow is built. Elder Rowan greets the robot beneath the tree; use **E** or the Continue button to hear his tale, or Escape to listen later. Follow the sunflowers to **Firstlight Village**, a sanctuary enclosed by stone walls and corner towers, with an open gatehouse, four cottages, three villagers, a vegetable garden, and a silent windmill waiting to be repaired. Cool overcast light, low mist, muted foliage, and a slower minor-key score keep the fields gloomy; warm lanterns mark the entrance and well. Entering the village restores health and establishes the chapter's checkpoint; **E** near the well restores health and stamina again.

Twelve creatures inhabit the meadow: quick briar wolves, thornlings, and durable stone golems with slower, stronger attacks. They retreat when the player enters the village or the elder's clearing. Defeated creatures stay defeated after a retry. Clearing the meadow completes the protection objective and leaves exploration open. Greenfields milestone saves preserve defeated creatures, elder conversations, the sanctuary reached, and Firstlight quest progress. **Continue Journey** resumes from a safe field checkpoint with full health after reloading. Saves belong to this browser and origin. If browser storage is unavailable, an indicator says that progress is session-only. **New Journey** asks before replacing the saved journey; it preserves graphics/audio settings.

**A Light to Come Home To:** speak with Mara near the village well, recover the Blender-authored copper winding beside the pond cart and the sunwheel beneath the western arch, then bring both back. Components can be collected in either order, including before meeting Mara. **J** opens a journal with landmark directions and a recovered millkeeper memory. Returning the parts starts the mill, adds supplies, lanterns, and flowers, brings Pip to the square, and installs the **Firstlight Capacitor: +20 maximum energy**. The repair and upgrade survive defeat and reload. Mara and Pip acknowledge your help. The written memory is currently presented as text with synthesized discovery audio, without recorded voice acting.

**Three robot disciplines:** after restoring the mill, use **E** at the well to rest and open the discipline choice. **Stormblade** spends 38 energy to strike up to three creatures with short chain lightning (7-second cooldown). **Bulwark** stores one charge when a frontal guard is raised within 0.22 seconds of impact; **Q** spends that charge and 26 energy on a staggering shockwave (6-second cooldown). **Wispkeeper** spends 30 energy to send a Blender-authored drone that interrupts and distracts one creature for 2.6 seconds (10-second cooldown); damage ends the distraction. Abilities respect walls and sanctuary boundaries. Switching is free and preserves current energy and cooldown. The selected discipline survives saving and retry; retries clear temporary charge and effects. The sword, guard, and evade remain available. The picker and journal pause gameplay.

Ordinary creature attacks now show a directional amber warning, commit their aim during preparation, and inflict damage once when the animated strike reaches contact. Wolves bite, spiders thrust, golems bring both fists down, thornlings swipe, and sentinels swing their swords. A sidestep behind a committed strike avoids it. The Reaper’s scythe animation follows its individual damage beats, including the third cut in phase two.

The boss bar appears when the Reaper wakes. Amber and crimson floor tells show incoming attacks. Aim your guard toward the attacker; heavy attacks cause a little damage through a successful block. Evade a committed attack, then strike during recovery. Below half health, the Reaper enters **The Hollow Hunger**: faster pursuit, shorter recovery, a third scythe cut, denser grave spires, staggered crossing blades, and a shockwave after its aerial slam. Its skeletal mantle unfolds and jaw opens during a 3.4-second Blender transformation. Cold focused light keeps the silhouette readable against the darker violet chamber.

The nine attacks include the original cuts, execution, rush, soul ring, hunting shadows and grave spires, plus:

- **Widow’s Return:** a spectral crescent hooks outward, then returns along a wider curved lane. Watch both paths; backtracking is dangerous.
- **Gallows Fall:** the Reaper crouches, leaps above the chamber, and slams onto a fixed warning circle. Phase two adds an expanding outer ring. Leave the mark before touchdown, then cross the wave or remain inside its emptied centre.
- **The Widow’s Loom:** phase two opens with four staggered crescents on crossing diagonal lanes. Step into a gap and punish the long recovery.

All Reaper poses are sampled from 24 Blender-authored glTF clips, including anticipation, contact, recovery, wake, death, gait and transformation. Close-range aim commits halfway through the windup; the new flight paths and landing mark commit at the start. Damage uses the same paths and timings as the visible attacks. Death, phase changes and retries cancel warnings and hazards.

Local review: `?encounter=reaper&phase=2&attack=loom&pose=windup` holds a real encounter pose with a **Play encounter** button. `pose=impact`, `pose=return`, and `pose=transformation` inspect other moments. `?encounter=exit` shows the opening gate. These routes are excluded from production and do not write journey progress.

## Architecture

- `src/game`: state orchestration, configuration, input, camera, and substepped circle/AABB collisions.
- `src/combat`: discipline abilities, wall-aware targeting, temporary drone control, and lightning effects.
- `src/progression`: the Firstlight quest, validated versioned journey saves, and persistent rewards.
- `src/player`: Blender robot assets, pivot animation, movement, guard, attacks, and health.
- `src/enemies`: castle guardians, three field creature models and combat profiles, the Reaper, and encounter lifecycle.
- `src/world`: five connected castle dioramas, a separate meadow/village map, map resource disposal, lighting, particles, and a shared planar puddle reflection.
- `src/audio`: original synthesized ambient score, boss score, and combat foley.
- `src/ui`: chapter loading, title/continue, character dialogue, quest journal, HUD, settings, pause, and defeat screens.

Both environments use original Blender assets: 35 castle models cover the pointed arches, recessed windows, fluted columns, worn floors, furniture, statues, and props; 38 Greenfields assets cover terrain, foliage, buildings, villagers, the elder, and monsters. Editable libraries, authoring scripts, and individual studio renders are in `art/`; see [the Blender asset guide](art/blender/README.md). The castle creatures also use an original Blender library: a plated sentinel, a fanged crypt spider, a towering hooded Reaper, its grave spires, and a separate crescent projectile. A deep cloth cowl surrounds the recessed skull; the cloak, skeletal legs, arms, and scythe keep separate animation pivots. The last machine, sword, and support drone also come from an editable Blender library. All physical models are Blender-authored; UI, lighting, particles, water shading, and magical effects use code. No external asset services, runtime APIs, or backend are required. Cinzel and Inter are bundled locally under their font packages' Open Font Licenses. The initial path loads WebGL and the game; the WebGPU renderer is a separate dynamic chunk, loaded only when the browser exposes WebGPU.

## Rendering and performance

WebGPU is attempted first on supported browsers, with Three.js's WebGL 2 backend fallback and a conventional WebGLRenderer fallback if initialization fails. See the [Three.js renderer documentation](https://threejs.org/manual/en/webgpurenderer).

The castle loads its approximately 4.1 MB environment library and 1.9 MB animated creature library together before revealing the scene. The approximately 1.3 MB machine library supplies the player in both chapters and the field support drone. Enemy clones share geometry and materials; the Reaper has 5,398 triangles. Ground attacks use a pool of twelve warnings and spires. It uses instanced Blender flagstones, material-based static geometry merging per area, area and frustum culling, four selected torch lights, one shadow-casting directional light, a boss rim and focused key light, one shadow-casting exit spotlight, and pooled particles and rings. Water combines irregular PBR puddles, a small procedural environment map, and one shared planar reflection of the scene. The reflection camera supplies correct perspective and surface occlusion; puddle geometry masks the result, with a soft shoreline fade, a five-tap blur, and subtle ripple distortion. High/Medium cap the extra render target at 768/384 pixels on its longest side; Low disables that pass. Three.js Reflector handles conventional WebGL and ReflectorNode handles WebGPU and its WebGL backend. Fog uses depth fog and inexpensive textured planes. Emissive glows replace an expensive bloom pipeline.

The Greenfields code, its approximately 4.4 MB environment library, and the 0.41 MB Firstlight component library load when the chapter begins. Repeated foliage and props use spatially grouped instances sharing geometry and materials. The map uses frustum culling, distance-limited enemy updates, and a single shadow-casting overcast key light, plus three unshadowed warm village lights. The exported terrain heightfield keeps characters, camera targets, and effects aligned with the hills. It has no castle rain, torch lights, or reflection pass. Map transitions release outgoing geometries, materials, textures, shadow maps, and reflection targets before building the next scene.

Settings adjust resolution, shadows, reflections, and particles. Sustained slow frames reduce resolution gradually. 1080p/60 FPS remains a target, not a measured guarantee. The revised gloomy fields, enclosing village walls, and discipline picker were inspected in the desktop browser; every Blender asset was rendered individually for visual review. Headless tests additionally verify exported mesh attributes and pivots, the recessed hood opening, terrain contact against raycast hits, discrete boss impact timing, evasion, phase transitions, combat, traversability, gate opening, map loading and disposal, elder dialogue state, safe-zone retreat, and village retries. These checks do not establish cross-device frame rates or encounter difficulty. The Firstlight additions have browser checks for dialogue, discoveries, journal controls, and the restoration reward; automated tests cover pickup order, duplicate prevention, restored paths, energy regeneration/retry, save validation, storage failures, preview isolation, and saved chapter reconstruction. First-play duration depends on exploration and combat skill.

## Static deployment

Run `npm run build` and publish `dist/`:

- **Vercel:** Vite preset, build command `npm run build`, output `dist`.
- **Netlify:** included `netlify.toml` supplies the build and publish directory.
- **Cloudflare Pages:** build command `npm run build`, output `dist`.
- **GitHub Pages:** upload `dist/` as a Pages artifact. Vite's relative base supports repository subpaths.

The project has no server routes or secrets. Use HTTPS in production for WebGPU and fullscreen support.
