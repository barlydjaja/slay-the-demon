import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
/** Physical player equipment is authored and bevelled in Blender. */
export class RobotAssets {
  constructor(private library: THREE.Group) {
    library.traverse((part) => {
      if (part instanceof THREE.Mesh) {
        part.castShadow = true;
        part.receiveShadow = true;
      }
    });
  }
  static async load() {
    const gltf = await new GLTFLoader().loadAsync(
      new URL('models/last-machine.glb', document.baseURI).href,
    );
    return new RobotAssets(gltf.scene);
  }
  clone(name: 'robot' | 'wisp_drone') {
    const part = this.library.getObjectByName(name);
    if (!part) throw new Error(`Missing Blender machine asset: ${name}`);
    return part.clone(true) as THREE.Group;
  }
}
