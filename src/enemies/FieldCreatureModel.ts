import * as THREE from 'three';
import type { FieldMonster } from '../world/GreenfieldsConfig';
/** Blender mesh parts retain their authored pivots for the existing combat animation. */
export class FieldCreatureModel {
  group: THREE.Group;
  private body: THREE.Object3D;
  private head: THREE.Object3D;
  private limbs: THREE.Object3D[] = [];
  constructor(
    private type: FieldMonster,
    template?: THREE.Group,
  ) {
    if (!template) throw new Error(`Blender creature asset not loaded: ${type}`);
    this.group = template;
    this.body = template.getObjectByName(`${type}_body`)!;
    this.head = template.getObjectByName(`${type}_head`)!;
    if (!this.body || !this.head) throw new Error(`Missing animation pivots: ${type}`);
    for (let i = 0; i < 4; i++) {
      const limb = template.getObjectByName(`${type}_limb_${i}`);
      if (limb) this.limbs.push(limb);
    }
  }
  animate(time: number, moving: boolean, windup: number, attack: number, dead = 0) {
    const pace = this.type === 'wolf' ? 13 : this.type === 'golem' ? 5 : 8;
    this.body.position.y = dead
      ? -Math.min(0.7, dead * 0.4)
      : Math.sin(time * (moving ? pace : 2)) * (moving ? 0.055 : 0.013);
    this.body.rotation.z = dead ? Math.min(1.5, dead * 2) : 0;
    this.body.rotation.x = -windup * 0.22 + attack * 0.38;
    this.head.rotation.y = Math.sin(time * 1.3) * 0.08;
    this.limbs.forEach(
      (limb, i) =>
        (limb.rotation.x =
          (moving ? Math.sin(time * pace + i * Math.PI) * 0.45 : 0) - windup * 0.9 + attack * 1.3),
    );
  }
}
