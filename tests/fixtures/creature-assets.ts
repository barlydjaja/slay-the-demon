import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CastleCreatureAssets } from '../../src/enemies/CastleCreatureAssets';

export async function loadCreatureAssets() {
  const data = await readFile(new URL('../../public/models/castle-creatures.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    '',
  );
  return new CastleCreatureAssets(gltf.scene, gltf.animations);
}
