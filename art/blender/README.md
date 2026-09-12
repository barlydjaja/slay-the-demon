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
