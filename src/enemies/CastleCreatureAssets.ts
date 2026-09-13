import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Shared geometry/materials from the editable Blender monster library. */
export class CastleCreatureAssets {
  constructor(
    private library: THREE.Group,
    private clips: THREE.AnimationClip[] = [],
  ) {
    library.traverse((part) => {
      if (part instanceof THREE.Mesh) {
        part.castShadow = true;
        part.receiveShadow = true;
      }
    });
  }
  static async load() {
    const url = new URL('models/castle-creatures.glb', document.baseURI).href;
    const gltf = await new GLTFLoader().loadAsync(url);
    return new CastleCreatureAssets(gltf.scene, gltf.animations);
  }
  clone(name: 'armor' | 'spider' | 'reaper' | 'grave_spire' | 'widow_blade') {
    const asset = this.library.getObjectByName(name);
    if (!asset) throw new Error(`Missing Blender monster: ${name}`);
    const copy = asset.clone(true) as THREE.Group;
    if (name === 'reaper') copy.animations = this.clips;
    return copy;
  }
}
