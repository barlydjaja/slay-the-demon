import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RobotAssets } from '../../src/player/RobotAssets';
export async function loadMachineAssets() {
  const data = await readFile(new URL('../../public/models/last-machine.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    '',
  );
  return new RobotAssets(gltf.scene);
}
