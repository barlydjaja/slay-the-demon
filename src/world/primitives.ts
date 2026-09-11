import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
const geometries = new Map<string, THREE.BufferGeometry>();
/** Called only after every object in the outgoing map has been released. */
export function clearPrimitiveCache() {
  for (const geometry of geometries.values()) geometry.dispose();
  geometries.clear();
}
function cached(key: string, create: () => THREE.BufferGeometry) {
  if (!geometries.has(key)) geometries.set(key, create());
  return geometries.get(key)!;
}
export function box(
  parent: THREE.Object3D,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  rounded = false,
) {
  const geometry = rounded
    ? cached('round', () => new RoundedBoxGeometry(1, 1, 1, 2, 0.16))
    : cached('box', () => new THREE.BoxGeometry(1, 1, 1));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(w, h, d);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
export function sphere(
  parent: THREE.Object3D,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy = sx,
  sz = sx,
) {
  const mesh = new THREE.Mesh(
    cached('sphere', () => new THREE.SphereGeometry(1, 12, 8)),
    material,
  );
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
export function cylinder(
  parent: THREE.Object3D,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  r1: number,
  r2: number,
  height: number,
  sides = 8,
) {
  const key = `c${r1}-${r2}-${height}-${sides}`;
  const mesh = new THREE.Mesh(
    cached(key, () => new THREE.CylinderGeometry(r1, r2, height, sides)),
    material,
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
const direction = new THREE.Vector3(),
  mid = new THREE.Vector3(),
  up = new THREE.Vector3(0, 1, 0);
export function segment(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, radius: number) {
  direction.subVectors(b, a);
  mid.addVectors(a, b).multiplyScalar(0.5);
  mesh.position.copy(mid);
  mesh.scale.set(radius, direction.length(), radius);
  mesh.quaternion.setFromUnitVectors(up, direction.normalize());
}
export function rod(parent: THREE.Object3D, material: THREE.Material) {
  const m = new THREE.Mesh(
    cached('rod', () => new THREE.CylinderGeometry(0.65, 1, 1, 6)),
    material,
  );
  m.castShadow = true;
  parent.add(m);
  return m;
}
