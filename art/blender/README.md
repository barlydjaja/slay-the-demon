# Blender asset libraries

## Castle

`castle-library.blend` contains 34 original castle assets, arranged for editing. `build_castle.py` constructs the architectural silhouettes and details in Blender, welds and bevels selected meshes, exports the game library, and renders each model with Cycles.

```sh
blender --background --factory-startup --python art/blender/build_castle.py
python art/blender/make_review_sheets.py castle
```

The runtime export is `public/models/castle-kit.glb`; the measured inventory is `art/blender/castle-manifest.json`. Individual renders and three contact sheets are in `art/review/castle/`. Passing asset names after `--` regenerates the complete library but limits studio rendering to those names.

The kit includes pointed and broken portals, walls with real window openings, a portcullis, fluted pillars, a fountain, sentinel statues, a throne, pews, an altar, a sanctuary, timber doors, a desk with books, dead trees, cloth, ivy, rubble, lighting props, and floor inlays. The level keeps its original collision layout, guardian seals, memories, and checkpoints. Floors use instancing; static decorations merge by material within each existing area. The portcullis and sanctuary crystal keep independent animation pivots.

All 34 studio renders were inspected. Revisions reduced floor contrast, closed cloth seams, replaced metal rods with fractured stone, and reduced small bevel geometry. The castle was also inspected in the browser. Tests load the actual GLB, validate all mesh attributes, check a clear portal opening and ground-level floors, verify routes through all five areas, and exercise the seals, sanctuary animation, and boss exit. Cross-device performance has not been certified.

## Greenfields

`greenfields-library.blend` is the editable, organized library of 35 original models. `build_greenfields.py` authors the meshes, paints vertex colors, exports the runtime GLB, and renders each asset in Blender. Originally created with Blender 4.5.13 LTS; the gloomy palette, emissive creature eyes, and village fortifications were rebuilt with Blender 5.2.1 LTS.

From the project root, using your Blender executable:

```sh
blender --background --factory-startup --python art/blender/build_greenfields.py
```

Outputs:

- `public/models/greenfields-kit.glb`: the runtime models, shared materials, animation pivots, and terrain heightfield.
- `art/blender/greenfields-library.blend`: editable assets arranged in a grid.
- `art/blender/asset-manifest.json`: each model's triangle count, mesh count, and bounds.
- `art/review/*.png`: one neutral studio render per asset using Cycles.
- `art/review/asset-sheet-{1,2,3}.jpg`: review sheets assembled by `make_review_sheets.py` with Pillow.

The script uses game coordinates `(x, height, z)` and converts to Blender coordinates before glTF export. Runtime roots have an origin at ground level; named monster body, head, and limb pivots and the windmill sail pivot support animation. The saved library's grid arrangement is applied after export, so it does not shift runtime models.

All 38 studio renders were inspected. Review corrections included foliage pole seams, barrel construction, cottage windows, and simpler flower geometry. Browser inspection confirmed the models in the meadow and village, smooth path transitions, and building placement. Automated checks load the actual GLB, verify mesh attributes and pivots, compare movement heights with raycast hits on the exported terrain, and confirm access to the elder, village well, and all encounters. Cross-device frame rates have not been certified.

During local development, `?chapter=fields&view=village` enters the rebuilt village for inspection. `view=pond` and `view=ruins` select other inspection positions. These shortcuts are disabled in production builds.

## Castle creatures

`monsters-library.blend` contains the original plated sentinel (`armor`), crypt spider (`spider`), Hooded Reaper (`reaper`), `grave_spire`, and `widow_blade`. The Reaper has a deep cowl with a thick rim and recessed lining, an inset skull and emissive eyes, layered torn cloth, skeletal legs and fingers, chest bones, chains, and a forged crescent scythe. Named pivots keep body, head, arms, legs, and weapon separately animated in the game.

```sh
blender --background --factory-startup --python art/blender/build_monsters.py
python art/blender/make_review_sheets.py monsters
```

The runtime library is `public/models/castle-creatures.glb` (about 1.9 MB). `monsters-manifest.json` records the measured bounds and mesh/triangle counts. Individual Cycles renders, including front and back Reaper views, are in `art/review/monsters/`. The original creature views and the new transformation/contact renders were visually reviewed. Tests load the actual export, check geometry and ground contact, raycast the hood's opening, and exercise the animation pivots and combat mechanics.

For local inspection, `?encounter=reaper` starts at the boss entrance; `?encounter=guardians` starts in the courtyard. Add `&attack=slash|heavy|hunt|lunge|sweep|eruption|reave|dive|loom` to select the first boss attack or `&phase=2` to inspect the second phase. These routes are disabled in production. The ordinary journey still reaches the boss through the sanctuary and opens the Greenfields exit after victory.

## Firstlight recovery components

`firstlight-library.blend` contains the original sunwheel and copper winding for Mara’s restoration quest. `build_firstlight.py` creates an open-spoked brass gear with twelve teeth and a continuous copper coil with end plates, exports the runtime library, and renders both assets with Cycles.

```sh
blender --background --factory-startup --python art/blender/build_firstlight.py
```

The runtime export is `public/models/firstlight-kit.glb` (about 0.41 MB; no texture downloads). `firstlight-manifest.json` records geometry counts and bounds. Both studio renders in `art/review/firstlight/` were inspected; review corrections closed the gear tooth sides and separated adjacent coil turns. Tests verify finite mesh attributes, exported scale, ground clearance at the pickup animation’s lowest point, and the 0.5 MB budget.

In development, use `?chapter=fields&view=mara`, `view=winding`, or `view=sunwheel` to inspect the quest locations. `view=repair` starts beside Mara with both parts recovered, ready for the homecoming conversation. These inspection routes are excluded from production and do not write to the normal journey save.

## The last machine and its support drone

`build_machine.py` authors the blue robot, its sword, and the Wispkeeper support drone in Blender. Metal vertices are welded, normals corrected, and bevels applied before export. Named body, head, arm, leg, and weapon pivots drive gameplay animation without moving the actor’s world position. The closed rotor guards were revised after studio review.

```sh
blender --background --factory-startup --python art/blender/build_machine.py
```

Outputs: `machine-library.blend`, `machine-manifest.json`, `public/models/last-machine.glb` (about 1.3 MB), and two Cycles renders in `art/review/machine/`. Both physical models have complete finite positions, normals, vertex colors, and UVs. The robot is about 10,000 triangles; the drone is about 4,000. Both chapters load the robot from this library. No physical robot geometry is generated by Three.js.

## Gloomy Greenfields and village fortifications

The field kit now includes `village_wall`, `village_gate`, and `village_tower`. The walls retain foundation skirts below their origins for terrain contact. The gate has a real opening and open reinforced leaves. Runtime placement and collision surround the village on four sides; the gate is on the southern approach at `(14, -10)`. Terrain and vegetation colors are painted in Blender, and creature eyes use separate emissive Blender meshes that follow their head pivots.

The latest full field rebuild produces 38 models and four contact sheets. Subsequent creature-eye renders replace their earlier views. Run `make_review_sheets.py` after rendering to refresh the sheets. Lighting, mist, UI, and combat effects remain code-rendered; all physical models are Blender-authored.

Development inspection routes:

- `?chapter=fields&view=village`: enclosed village before restoration.
- `?chapter=fields&view=disciplines`: restored village beside the well; press E to choose.
- `?chapter=fields&view=combat&discipline=stormblade` (or `bulwark`, `wispkeeper`): the same eastern wolf encounter with a selected discipline.

These routes are development-only and never write the normal journey save.


## Reaper motion and the far gate

`animate_reaper.py` is called by `build_monsters.py`. It authors 24 named NLA clips in Blender at 100 FPS with poses keyed at 50 Hz. Anticipation, contact and recovery cover every attack; phase two retains its unfolded mantle and open jaw in every clip. The scythe wrist follows the right hand; its metal ferrules follow the curved shaft. A vertebral neck keeps the twisting hood connected, and the unfolding mantle widens the silhouette. Attack lengths are read from `src/enemies/BossAI.ts`; `reaper-animation-manifest.json` records clip durations and contacts. Runtime `AuthoredAnimation` samples the exported clips against the encounter timer. It does not generate the boss combat poses.

Keep `export_optimize_animation_keep_anim_object=True`: constant pose channels preserve the transformed silhouette across clips. In Blender, mute all NLA tracks except the same desired clip name on each Reaper pivot to inspect an action. The source file opens with the tracks muted so the library stays in its neutral rest pose. To render actual keyed poses:

```sh
blender --background --factory-startup --python art/blender/review_reaper_motion.py
```

`build_threshold.py`, called by `build_castle.py`, adds `exit_threshold`: a vaulted passage with four receding arches, carved masks, iron portcullis, two counterweights, chains and seven feathered light curtains. The 4.4-second `threshold_open` clip lifts the gate and lowers the weights. Runtime cool light casts the moving geometry across the floor. The light curtains retain a per-vertex alpha gradient, so there is no opaque yellow panel. The exported castle kit now has 35 assets. Gate collision clears only when the animated ironwork rises above four metres, and resets with the animation.

Local review URLs include `?encounter=exit` and `?encounter=reaper&phase=2&attack=loom&pose=windup`. `pose=impact` holds the leap apex or blade contact, `pose=return` holds the returning crescent, and `pose=transformation` holds the mantle rupture. The Play encounter button resumes simulation. Review routes are development-only and preserve normal saved journeys.
