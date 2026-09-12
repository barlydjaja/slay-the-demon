import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** The castle's architecture and props are authored and exported from Blender. */
export class CastleAssets {
  constructor(private library: THREE.Group) {
    library.updateMatrixWorld(true);
    library.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }
  static async load() {
    const url = new URL('models/castle-kit.glb', document.baseURI).href;
    const gltf = await new GLTFLoader().loadAsync(url);
    return new CastleAssets(gltf.scene);
  }
  clone(name: string) {
    const object = this.library.getObjectByName(name);
    if (!object) throw new Error(`Missing Blender castle asset: ${name}`);
    return object.clone(true) as THREE.Group;
  }
  place(parent: THREE.Object3D, name: string, x: number, y: number, z: number, scale = 1, yaw = 0) {
    const object = this.clone(name);
    object.position.set(x, y, z);
    object.scale.setScalar(scale);
    object.rotation.y = yaw;
    parent.add(object);
    return object;
  }
  batch(parent: THREE.Object3D, name: string, matrices: THREE.Matrix4[], shadow = false) {
    const template = this.clone(name);
    template.updateMatrixWorld(true);
    template.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
      const mesh = new THREE.InstancedMesh(geometry, object.material, matrices.length);
      matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
      mesh.name = `${name} instances`;
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      parent.add(mesh);
    });
  }
}
