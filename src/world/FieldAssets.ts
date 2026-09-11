import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
interface Heightfield {
  minX: number;
  minZ: number;
  columns: number;
  rows: number;
  step: number;
  heights: number[];
}
export interface Placement {
  x: number;
  z: number;
  y?: number;
  scale?: number;
  yaw?: number;
}
/** Authored and vertex-painted in Blender; all instances share geometry and materials. */
export class FieldAssets {
  private heightfield: Heightfield;
  constructor(private library: THREE.Group) {
    const terrain = library.getObjectByName('terrain');
    if (!terrain?.userData.heightfield) throw new Error('The meadow heightfield is missing.');
    this.heightfield = JSON.parse(terrain.userData.heightfield);
    library.updateMatrixWorld(true);
    library.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }
  static async load() {
    const url = new URL('models/greenfields-kit.glb', document.baseURI).href;
    const gltf = await new GLTFLoader().loadAsync(url);
    return new FieldAssets(gltf.scene);
  }
  clone(name: string) {
    const template = this.library.getObjectByName(name);
    if (!template) throw new Error(`Missing Blender asset: ${name}`);
    return template.clone(true) as THREE.Group;
  }
  heightAt = (x: number, z: number) => {
    const h = this.heightfield;
    const fx = THREE.MathUtils.clamp((x - h.minX) / h.step, 0, h.columns - 1.00001);
    const fz = THREE.MathUtils.clamp((z - h.minZ) / h.step, 0, h.rows - 1.00001);
    const ix = Math.floor(fx),
      iz = Math.floor(fz),
      tx = fx - ix,
      tz = fz - iz;
    const a = h.heights[iz * h.columns + ix],
      b = h.heights[iz * h.columns + ix + 1];
    const d = h.heights[(iz + 1) * h.columns + ix],
      c = h.heights[(iz + 1) * h.columns + ix + 1];
    // Same two triangles as the exported terrain; feet follow the visible surface.
    return tx > tz ? a + (b - a) * tx + (c - b) * tz : a + (c - d) * tx + (d - a) * tz;
  };
  place(parent: THREE.Object3D, name: string, p: Placement) {
    const root = this.clone(name);
    root.position.set(p.x, p.y ?? this.heightAt(p.x, p.z), p.z);
    root.rotation.y = p.yaw ?? 0;
    root.scale.setScalar(p.scale ?? 1);
    parent.add(root);
    return root;
  }
  scatter(parent: THREE.Object3D, name: string, placements: Placement[], shadow = true) {
    const template = this.clone(name);
    template.updateMatrixWorld(true);
    const cells = new Map<string, Placement[]>();
    for (const p of placements) {
      const key = `${Math.floor(p.x / 30)}:${Math.floor(p.z / 30)}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key)!.push(p);
    }
    template.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const geometry = o.geometry.clone().applyMatrix4(o.matrixWorld);
      for (const cell of cells.values()) {
        const batch = new THREE.InstancedMesh(geometry, o.material, cell.length);
        batch.name = `${name} · instances`;
        batch.castShadow = shadow;
        batch.receiveShadow = true;
        const dummy = new THREE.Object3D();
        cell.forEach((p, i) => {
          dummy.position.set(p.x, p.y ?? this.heightAt(p.x, p.z), p.z);
          dummy.rotation.y = p.yaw ?? 0;
          dummy.scale.setScalar(p.scale ?? 1);
          dummy.updateMatrix();
          batch.setMatrixAt(i, dummy.matrix);
        });
        batch.computeBoundingSphere();
        parent.add(batch);
      }
    });
  }
}
