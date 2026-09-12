import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FirstlightAssets } from '../../src/world/FirstlightAssets';
export async function loadFirstlightAssets() {
  const data = await readFile(new URL('../../public/models/firstlight-kit.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    '',
  );
  return new FirstlightAssets(gltf.scene);
}
