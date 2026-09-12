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

`greenfields-library.blend` is the editable, organized library of 35 original models. `build_greenfields.py` authors the meshes, paints vertex colors, exports the runtime GLB, and renders each asset in Blender. Created with official Blender 4.5.13 LTS.

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

All 35 studio renders were inspected. Review corrections included foliage pole seams, barrel construction, cottage windows, and simpler flower geometry. Browser inspection confirmed the models in the meadow and village, smooth path transitions, and building placement. Automated checks load the actual GLB, verify mesh attributes and pivots, compare movement heights with raycast hits on the exported terrain, and confirm access to the elder, village well, and all encounters. Cross-device frame rates have not been certified.

During local development, `?chapter=fields&view=village` enters the rebuilt village for inspection. `view=pond` and `view=ruins` select other inspection positions. These shortcuts are disabled in production builds.

## Castle creatures

`monsters-library.blend` contains the original plated sentinel (`armor`), crypt spider (`spider`), Hooded Reaper (`reaper`), and `grave_spire`. The Reaper has a deep cowl with a thick rim and recessed lining, an inset skull and emissive eyes, layered torn cloth, skeletal legs and fingers, chest bones, chains, and a forged crescent scythe. Named pivots keep body, head, arms, legs, and weapon separately animated in the game.

```sh
blender --background --factory-startup --python art/blender/build_monsters.py
python art/blender/make_review_sheets.py monsters
```

The runtime library is `public/models/castle-creatures.glb` (about 0.93 MB). `monsters-manifest.json` records the measured bounds and mesh/triangle counts. Individual Cycles renders, including front and back Reaper views, are in `art/review/monsters/`. All four models and the Reaper's additional views were visually reviewed. Tests load the actual export, check geometry and ground contact, raycast the hood's opening, and exercise the animation pivots and combat mechanics.

For local inspection, `?encounter=reaper` starts at the boss entrance; `?encounter=guardians` starts in the courtyard. Add `&attack=slash|heavy|hunt|lunge|sweep|eruption` to select the first boss attack or `&phase=2` to inspect the second phase. These routes are disabled in production. The ordinary journey still reaches the boss through the sanctuary and opens the Greenfields exit after victory.
