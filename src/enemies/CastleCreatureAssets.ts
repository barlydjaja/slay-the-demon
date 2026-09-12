import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Shared geometry/materials from the editable Blender monster library. */
export class CastleCreatureAssets {
  constructor(private library: THREE.Group) {
    library.traverse((part) => {
      if (part instanceof THREE.Mesh) {
        part.castShadow = true;
        part.receiveShadow = true;
      }
    });
  }
  static async load() {
    const url = new URL('models/castle-creatures.glb', document.baseURI).href;
    return new CastleCreatureAssets((await new GLTFLoader().loadAsync(url)).scene);
  }
  clone(name: 'armor' | 'spider' | 'reaper' | 'grave_spire') {
    const asset = this.library.getObjectByName(name);
    if (!asset) throw new Error(`Missing Blender monster: ${name}`);
    return asset.clone(true) as THREE.Group;
  }
}
