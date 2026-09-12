# Greenfields Blender assets

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
