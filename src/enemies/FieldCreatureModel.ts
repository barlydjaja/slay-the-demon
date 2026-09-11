import * as THREE from 'three';
import { box, sphere, cylinder } from '../world/primitives';
import type { FieldMonster } from '../world/GreenfieldsConfig';
export class FieldCreatureModel {
  group = new THREE.Group();
  private body = new THREE.Group();
  private limbs: THREE.Group[] = [];
  private head = new THREE.Group();
  constructor(private type: FieldMonster) {
    this.group.add(this.body);
    const skin = new THREE.MeshStandardMaterial({
      color: type === 'wolf' ? 0x54644c : type === 'golem' ? 0x6d8061 : 0x8c6244,
      roughness: 0.95,
      flatShading: true,
    });
    const dark = new THREE.MeshStandardMaterial({ color: 0x303f35, roughness: 1 });
    const moss = new THREE.MeshStandardMaterial({ color: 0x7c9f42, roughness: 1 });
    const eye = new THREE.MeshStandardMaterial({
      color: 0xffca68,
      emissive: 0xee6419,
      emissiveIntensity: 1.4,
    });
    if (type === 'wolf') {
      sphere(this.body, skin, 0, 0.95, -0.12, 0.53, 0.59, 1);
      sphere(this.body, moss, 0, 1.2, 0.3, 0.68, 0.55, 0.62);
      this.head.position.set(0, 1.12, 0.83);
      sphere(this.head, skin, 0, 0, 0, 0.46, 0.45, 0.5);
      box(this.head, dark, 0, -0.07, 0.43, 0.42, 0.28, 0.5, true);
      for (const side of [-1, 1]) {
        const ear = cylinder(this.head, dark, side * 0.28, 0.48, -0.08, 0, 0.2, 0.5, 4);
        ear.rotation.z = -side * 0.3;
        sphere(this.head, eye, side * 0.23, 0.08, 0.4, 0.075);
        for (const z of [-0.62, 0.57]) {
          const limb = new THREE.Group();
          limb.position.set(side * 0.38, 0.75, z);
          box(limb, skin, 0, -0.27, 0, 0.22, 0.69, 0.27, true);
          box(limb, dark, 0, -0.64, 0.08, 0.3, 0.18, 0.4, true);
          this.body.add(limb);
          this.limbs.push(limb);
        }
      }
      const tail = cylinder(this.body, dark, 0, 1.09, -1.25, 0.07, 0.22, 1.1, 6);
      tail.rotation.x = -0.95;
      for (let i = 0; i < 4; i++)
        cylinder(this.body, moss, 0, 1.58, 0.2 - i * 0.3, 0, 0.19, 0.4, 4);
    } else if (type === 'golem') {
      box(this.body, skin, 0, 1.6, 0, 1.55, 1.5, 1, true);
      for (const s of [-1, 1]) {
        box(this.body, dark, s * 0.43, 0.42, 0, 0.58, 0.84, 0.68, true);
        const arm = new THREE.Group();
        arm.position.set(s * 1.02, 2, 0);
        sphere(arm, moss, 0, 0, 0, 0.55, 0.5, 0.5);
        box(arm, skin, 0, -0.68, 0.07, 0.65, 1.2, 0.7, true);
        this.body.add(arm);
        this.limbs.push(arm);
        box(this.body, eye, s * 0.3, 1.55, 0.51, 0.08, 0.6, 0.025);
      }
      this.head.position.y = 2.6;
      box(this.head, dark, 0, 0, 0, 0.9, 0.72, 0.85, true);
      for (const s of [-1, 1]) box(this.head, eye, s * 0.23, 0.04, 0.44, 0.16, 0.085, 0.025);
      sphere(this.head, moss, -0.17, 0.4, 0, 0.6, 0.19, 0.53);
      cylinder(this.head, skin, 0.3, 0.67, 0, 0, 0.13, 0.4, 4);
    } else {
      cylinder(this.body, skin, 0, 0.8, 0, 0.25, 0.4, 1.3, 7);
      this.head.position.y = 1.5;
      sphere(this.head, dark, 0, 0, 0, 0.45, 0.38, 0.4);
      sphere(this.head, moss, 0, 0.25, 0, 0.92, 0.36, 0.8);
      for (const s of [-1, 1]) {
        sphere(this.head, eye, s * 0.19, -0.015, 0.37, 0.08);
        const arm = new THREE.Group();
        arm.position.set(s * 0.4, 1, 0);
        const branch = cylinder(arm, skin, s * 0.2, -0.13, 0, 0.08, 0.14, 0.7, 5);
        branch.rotation.z = s * 0.9;
        cylinder(arm, dark, s * 0.46, 0.01, 0.1, 0, 0.13, 0.55, 4);
        this.body.add(arm);
        this.limbs.push(arm);
        box(this.body, dark, s * 0.23, 0.15, 0.09, 0.22, 0.3, 0.42, true);
      }
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        cylinder(this.head, skin, Math.sin(a) * 0.63, 0.57, Math.cos(a) * 0.53, 0, 0.1, 0.35, 4);
      }
    }
    this.body.add(this.head);
  }
  animate(time: number, moving: boolean, windup: number, attack: number, dead = 0) {
    const pace = this.type === 'wolf' ? 13 : this.type === 'golem' ? 5 : 8;
    this.body.position.y = dead
      ? -Math.min(0.7, dead * 0.4)
      : Math.sin(time * (moving ? pace : 2)) * (moving ? 0.07 : 0.02);
    this.body.rotation.z = dead ? Math.min(1.5, dead * 2) : 0;
    this.body.rotation.x = -windup * 0.22 + attack * 0.38;
    this.head.rotation.y = Math.sin(time * 1.3) * 0.09;
    this.limbs.forEach(
      (limb, i) =>
        (limb.rotation.x =
          (moving ? Math.sin(time * pace + i * Math.PI) * 0.55 : 0) - windup * 1.1 + attack * 1.6),
    );
  }
}
