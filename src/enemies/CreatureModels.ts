import * as THREE from 'three';
import type { AttackKind } from './BossAI';

/** Animate authored pivots without overwriting an actor's world position. */
class AuthoredModel {
  group: THREE.Group;
  private rest = new Map<THREE.Object3D, { position: THREE.Vector3; rotation: THREE.Euler }>();
  constructor(template: THREE.Group | undefined, name: string) {
    if (!template) throw new Error(`Blender creature asset not loaded: ${name}`);
    this.group = template;
    template.traverse((part) => {
      if (part !== template)
        this.rest.set(part, { position: part.position.clone(), rotation: part.rotation.clone() });
    });
  }
  protected part(name: string) {
    const part = this.group.getObjectByName(name);
    if (!part) throw new Error(`Missing Blender animation pivot: ${name}`);
    return part;
  }
  reset() {
    for (const [part, rest] of this.rest) {
      part.position.copy(rest.position);
      part.rotation.copy(rest.rotation);
    }
  }
}
export class ArmorModel extends AuthoredModel {
  private body: THREE.Object3D;
  private head: THREE.Object3D;
  private sword: THREE.Object3D;
  private shield: THREE.Object3D;
  private legs: THREE.Object3D[];
  constructor(template?: THREE.Group) {
    super(template, 'armor');
    this.body = this.part('armor_body');
    this.head = this.part('armor_head');
    this.sword = this.part('armor_arm_right');
    this.shield = this.part('armor_arm_left');
    this.legs = ['left', 'right'].map((side) => this.part(`armor_leg_${side}`));
  }
  animate(time: number, moving: boolean, windup = 0, attack = 0, death = 0) {
    this.reset();
    this.body.position.y += Math.sin(time * (moving ? 9 : 2)) * (moving ? 0.035 : 0.01);
    this.head.rotation.y = Math.sin(time * 0.9) * 0.07;
    this.legs.forEach((leg, i) => {
      leg.rotation.x = moving ? Math.sin(time * 9 + i * Math.PI) * 0.38 : 0;
    });
    this.sword.rotation.x = -windup * 0.95 + Math.sin(attack * Math.PI) * 1.65;
    this.sword.rotation.z = -0.12 - windup * 0.35;
    this.shield.rotation.x = windup * 0.24;
    if (death) {
      this.body.rotation.z = Math.min(1.65, death * 2);
      this.body.position.y -= Math.min(0.8, death);
    }
  }
}
export class SpiderModel extends AuthoredModel {
  private body: THREE.Object3D;
  private head: THREE.Object3D;
  private legs: THREE.Object3D[];
  constructor(template?: THREE.Group) {
    super(template, 'spider');
    this.body = this.part('spider_body');
    this.head = this.part('spider_head');
    this.legs = Array.from({ length: 8 }, (_, i) => this.part(`spider_leg_${i}`));
  }
  animate(time: number, moving: boolean, windup = 0, attack = 0, death = 0) {
    this.reset();
    this.body.position.y += Math.sin(time * (moving ? 15 : 3)) * 0.025 - Math.min(0.6, death);
    this.body.rotation.x = -windup * 0.2 + Math.sin(attack * Math.PI) * 0.24;
    this.head.rotation.x = -windup * 0.3;
    this.legs.forEach((leg, i) => {
      leg.rotation.y = moving ? Math.sin(time * 15 + (i % 2) * Math.PI) * 0.24 : 0;
      leg.rotation.z =
        (i < 4 ? -1 : 1) *
        (Math.max(0, Math.sin(time * 15 + i * 2)) * (moving ? 0.13 : 0) + Math.min(1.2, death));
    });
  }
}
export class ReaperModel extends AuthoredModel {
  private body: THREE.Object3D;
  private torso: THREE.Object3D;
  private head: THREE.Object3D;
  private cloak: THREE.Object3D;
  private scythe: THREE.Object3D;
  private arms: THREE.Object3D[];
  private legs: THREE.Object3D[];
  private eyes: THREE.MeshStandardMaterial;
  constructor(template: THREE.Group) {
    super(template, 'reaper');
    this.body = this.part('reaper_body');
    this.torso = this.part('reaper_torso');
    this.head = this.part('reaper_head');
    this.cloak = this.part('reaper_cloak');
    this.scythe = this.part('reaper_scythe');
    this.arms = ['left', 'right'].map((side) => this.part(`reaper_arm_${side}`));
    this.legs = Array.from({ length: 8 }, (_, i) => this.part(`reaper_leg_${i}`));
    const mesh = this.part('reaper_eyes') as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshStandardMaterial
    >;
    this.eyes = mesh.material = mesh.material.clone();
  }
  animate(
    time: number,
    moving: boolean,
    windup = 0,
    attack = 0,
    death = 0,
    kind: AttackKind = 'slash',
    phase = 1,
    ritual = 0,
  ) {
    this.reset();
    const pace = phase === 2 ? 12 : 9;
    this.body.position.y += Math.sin(time * (moving ? pace : 1.9)) * (moving ? 0.06 : 0.025);
    this.torso.rotation.z = Math.sin(time * 1.2) * 0.025;
    this.head.rotation.z = Math.sin(time * 0.65) * 0.09;
    this.head.rotation.x = -windup * 0.1 - ritual * 0.28;
    this.cloak.rotation.x = Math.sin(time * 2.3) * 0.025 + (moving ? 0.05 : 0);
    this.eyes.emissiveIntensity = death ? 0 : (phase === 2 ? 5 : 2.8) + Math.sin(time * 3) * 0.4;
    this.legs.forEach((leg, i) => {
      const gait = time * pace + (i % 2) * Math.PI + (i < 4 ? 0 : Math.PI);
      leg.rotation.y = moving ? Math.sin(gait) * 0.2 : Math.sin(time * 1.8 + i) * 0.012;
      leg.rotation.z = (i < 4 ? -1 : 1) * (moving ? Math.max(0, Math.sin(gait)) * 0.12 : 0);
    });
    const summon = kind === 'hunt' || kind === 'eruption' || kind === 'sweep';
    const cut = attack > 0 ? Math.sin(Math.min(1, (attack % 0.56) / 0.4) * Math.PI) : 0;
    this.scythe.rotation.x = summon
      ? -windup * 0.3
      : -windup * 0.55 + cut * (kind === 'heavy' ? 1.35 : 0.9);
    this.scythe.rotation.y = summon ? Math.sin(time * 2) * 0.05 : -windup * 0.65 + cut * 1.1;
    this.arms[1].rotation.x = this.scythe.rotation.x * 0.45;
    this.arms[0].rotation.x =
      -(summon ? windup * 1.3 + Math.sin(attack * Math.PI) * 1.3 : windup * 0.25) - ritual * 1.5;
    this.arms[0].rotation.z = -ritual * 0.6;
    this.arms[1].rotation.z = ritual * 0.55;
    if (kind === 'lunge') this.torso.rotation.x = windup * -0.17 + (attack > 0 ? 0.24 : 0);
    if (death) {
      this.body.position.y -= Math.min(1.1, death);
      this.torso.rotation.x = Math.min(1.4, death * 0.7);
      this.scythe.rotation.z = -Math.min(1.3, death);
      this.legs.forEach((leg, i) => {
        leg.rotation.z = (i < 4 ? 1 : -1) * Math.min(0.7, death);
      });
    }
  }
}
