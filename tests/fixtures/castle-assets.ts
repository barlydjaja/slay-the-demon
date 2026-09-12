import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CastleAssets } from '../../src/world/CastleAssets';

export async function loadCastleAssets() {
  const data = await readFile(new URL('../../public/models/castle-kit.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    '',
  );
  return new CastleAssets(gltf.scene);
}
