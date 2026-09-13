import * as THREE from 'three';
import {
  BOSS_ATTACKS,
  attackDuration,
  PHASE_DURATION,
  type AttackKind,
  type BossState,
} from './BossAI';
import { AuthoredAnimation } from '../world/AuthoredAnimation';
import { strikePose } from './AttackMotion';

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
  animate(time: number, moving: boolean, windup = 0, attack = 0, death = 0, hit = 0) {
    this.reset();
    this.body.position.y += Math.sin(time * (moving ? 9 : 2)) * (moving ? 0.035 : 0.01);
    this.head.rotation.y = Math.sin(time * 0.9) * 0.07;
    this.legs.forEach((leg, i) => {
      leg.rotation.x = moving ? Math.sin(time * 9 + i * Math.PI) * 0.38 : 0;
    });
    const strike = strikePose(windup, attack);
    this.sword.rotation.x = strike * 1.35;
    this.body.rotation.x = -Math.sin((hit / 0.3) * Math.PI) * 0.2;
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
  animate(time: number, moving: boolean, windup = 0, attack = 0, death = 0, hit = 0) {
    this.reset();
    this.body.position.y += Math.sin(time * (moving ? 15 : 3)) * 0.025 - Math.min(0.6, death);
    const strike = strikePose(windup, attack);
    this.body.rotation.x = strike * 0.22 - Math.sin((hit / 0.3) * Math.PI) * 0.25;
    this.body.position.z += Math.max(0, strike) * 0.35;
    this.head.rotation.x = strike * 0.32;
    this.legs.forEach((leg, i) => {
      leg.rotation.y = moving ? Math.sin(time * 15 + (i % 2) * Math.PI) * 0.24 : 0;
      leg.rotation.z =
        (i < 4 ? -1 : 1) *
        (Math.max(0, Math.sin(time * 15 + i * 2)) * (moving ? 0.13 : 0) + Math.min(1.2, death));
    });
  }
}
export class ReaperModel extends AuthoredModel {
  private animation: AuthoredAnimation;
  private eyes: THREE.MeshStandardMaterial[] = [];
  constructor(template: THREE.Group) {
    super(template, 'reaper');
    this.animation = new AuthoredAnimation(template);
    for (const name of ['reaper_eyes', 'reaper_heart_eyes']) {
      const mesh = this.part(name) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
      this.eyes.push((mesh.material = mesh.material.clone()));
    }
  }
  animateState(
    state: BossState,
    kind: AttackKind,
    phase: number,
    timer: number,
    time: number,
    death = 0,
  ) {
    const data = BOSS_ATTACKS[kind],
      duration = attackDuration(kind, phase);
    let clip = `reaper_idle_${phase}`,
      seconds = time,
      loop = true;
    if (state === 'chase' || state === 'reposition') clip = `reaper_walk_${phase}`;
    else if (state === 'wake' || state === 'phase' || state === 'dead') {
      clip = `reaper_${state === 'dead' ? 'death' : state}`;
      seconds = state === 'dead' ? death : (state === 'phase' ? PHASE_DURATION : 2.7) - timer;
      loop = false;
    } else if (state === 'prepare' || state === 'attack' || state === 'recover') {
      clip = `reaper_${kind}_${phase}`;
      seconds =
        state === 'prepare'
          ? data.windup - timer
          : state === 'attack'
            ? data.windup + duration - timer
            : data.windup + duration + data.recovery * (phase === 2 ? 0.8 : 1) - timer;
      loop = false;
    }
    this.animation.sample(clip, seconds, loop);
    this.eyes.forEach((material, i) => {
      material.emissiveIntensity =
        state === 'dead' ? Math.max(0, 3 - death * 2) : phase === 2 ? 3.7 : i ? 0.8 : 2.1;
    });
  }
  // Same pose interface as ordinary actors, for previews and authored-contact inspection.
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
    const state: BossState = death
      ? 'dead'
      : ritual
        ? 'phase'
        : attack > 0
          ? 'attack'
          : windup > 0
            ? 'prepare'
            : moving
              ? 'chase'
              : 'idle';
    const timer =
      state === 'prepare'
        ? BOSS_ATTACKS[kind].windup * (1 - windup)
        : state === 'attack'
          ? attackDuration(kind, phase) - attack
          : 0;
    this.animateState(state, kind, phase, timer, time, death * 2);
  }
  override reset() {
    this.animation?.reset();
    super.reset();
  }
}
