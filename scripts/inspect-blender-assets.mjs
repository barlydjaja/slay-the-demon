import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
const data = await readFile('public/models/greenfields-kit.glb');
const gltf = await new GLTFLoader().parseAsync(
  data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
  '',
);
for (const name of [
  'terrain',
  'oak',
  'wolf',
  'wolf_body',
  'wolf_head',
  'wolf_limb_0',
  'windmill_sails',
]) {
  const o = gltf.scene.getObjectByName(name);
  console.log(
    name,
    'position',
    o.position.toArray(),
    'rotation',
    o.rotation.toArray(),
    'bounds',
    new THREE.Box3().setFromObject(o).min.toArray(),
    new THREE.Box3().setFromObject(o).max.toArray(),
  );
}
console.log('Asset library', data.byteLength, 'bytes');
