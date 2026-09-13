import * as THREE from 'three';
import { strikePose } from './AttackMotion';
import type { FieldMonster } from '../world/GreenfieldsConfig';
/** Blender mesh parts retain their authored pivots for the existing combat animation. */
export class FieldCreatureModel {
  group: THREE.Group;
  private body: THREE.Object3D;
  private head: THREE.Object3D;
  private rest = new Map<THREE.Object3D, THREE.Vector3>();
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
    for (const part of [this.body, this.head, ...this.limbs])
      this.rest.set(part, part.position.clone());
  }
  animate(time: number, moving: boolean, windup: number, attack: number, dead = 0, hit = 0) {
    for (const [part, position] of this.rest) {
      part.position.copy(position);
      part.rotation.set(0, 0, 0);
    }
    const pace = this.type === 'wolf' ? 13 : this.type === 'golem' ? 5 : 8;
    const strike = strikePose(windup, attack);
    this.body.position.y += dead
      ? -Math.min(0.7, dead * 0.4)
      : Math.sin(time * (moving ? pace : 2)) * (moving ? 0.035 : 0.013);
    this.body.rotation.z = dead ? Math.min(1.5, dead * 2) : 0;
    this.body.rotation.x = strike * 0.16 - Math.sin((hit / 0.3) * Math.PI) * 0.23;
    if (this.type === 'wolf') {
      // Hind legs push; forelegs reach. The bite carries the head forward.
      this.body.position.z += Math.max(0, strike) * 0.4;
      this.head.rotation.x = strike * 0.32;
      this.limbs.forEach((limb, i) => {
        const gait = moving ? Math.sin(time * pace + [0, Math.PI, Math.PI, 0][i]) * 0.48 : 0;
        limb.rotation.x = gait + (i < 2 ? strike * 0.2 : -Math.max(0, strike) * 0.65);
      });
    } else if (this.type === 'golem') {
      // Both fists rise over the head, then drive into the ground in front.
      this.limbs.forEach((limb, i) => {
        limb.rotation.x =
          windup > 0
            ? -windup * 2.6
            : attack > 0
              ? -1.75 + strike * 0.85
              : moving
                ? Math.sin(time * pace + i * Math.PI) * 0.23
                : 0;
        if (attack > 0 && attack > 0.42) limb.rotation.x *= (1 - attack) / 0.58;
      });
      this.body.position.y -= Math.max(0, strike) * 0.13;
    } else {
      this.body.rotation.y = -strike * 0.35;
      this.limbs.forEach((limb, i) => {
        limb.rotation.y = (i === 0 ? 1 : -1) * strike * 1.15;
        limb.rotation.x = -Math.max(0, strike) * 0.35;
      });
    }
  }
}
