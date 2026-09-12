import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { FirstlightPart } from '../progression/FirstlightQuest';
export class FirstlightAssets {
  constructor(private library: THREE.Group) {
    library.traverse((part) => {
      if (part instanceof THREE.Mesh) {
        part.castShadow = true;
        part.receiveShadow = true;
      }
    });
  }
  static async load() {
    return new FirstlightAssets(
      (
        await new GLTFLoader().loadAsync(
          new URL('models/firstlight-kit.glb', document.baseURI).href,
        )
      ).scene,
    );
  }
  clone(name: FirstlightPart) {
    const part = this.library.getObjectByName(name);
    if (!part) throw new Error(`Missing Blender Firstlight component: ${name}`);
    return part.clone(true) as THREE.Group;
  }
}
