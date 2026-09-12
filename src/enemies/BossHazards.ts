import * as THREE from 'three';
import { PLAYER } from '../game/config';
import type { Player } from '../player/Player';
import type { Effects } from '../world/Effects';
import type { AudioManager } from '../audio/AudioManager';

type HazardKind = 'shadow' | 'spire';
interface Hazard {
  group: THREE.Group;
  rim: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  fill: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  spire: THREE.Group;
  kind: HazardKind;
  age: number;
  delay: number;
  radius: number;
  damage: number;
  fired: boolean;
}
/** Fixed pool: each frozen floor mark warns once, strikes once, then retires. */
export class BossHazards {
  readonly group = new THREE.Group();
  private slots: Hazard[] = [];
  onDamage = (blocked: boolean) => {};
  onImpact = () => {};
  constructor(
    template: THREE.Group,
    private effects: Effects,
    private audio: AudioManager,
  ) {
    const ring = new THREE.RingGeometry(0.94, 1, 48);
    const disk = new THREE.CircleGeometry(1, 48);
    for (let i = 0; i < 12; i++) {
      const group = new THREE.Group();
      const material = new THREE.MeshBasicMaterial({
        color: 0xc677ee,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        fog: false,
        side: THREE.DoubleSide,
      });
      const rim = new THREE.Mesh(ring, material);
      const fill = new THREE.Mesh(disk, material.clone());
      fill.material.opacity = 0.12;
      rim.rotation.x = fill.rotation.x = -Math.PI / 2;
      rim.position.y = 0.075;
      fill.position.y = 0.07;
      const spire = template.clone(true);
      group.add(rim, fill, spire);
      group.visible = false;
      this.group.add(group);
      this.slots.push({
        group,
        rim,
        fill,
        spire,
        kind: 'shadow',
        age: 0,
        delay: 1,
        radius: 1,
        damage: 0,
        fired: false,
      });
    }
  }
  get activeCount() {
    return this.slots.filter((slot) => slot.group.visible).length;
  }
  spawn(kind: HazardKind, x: number, z: number, delay: number, radius: number, damage: number) {
    const slot = this.slots.find((candidate) => !candidate.group.visible);
    if (!slot) return;
    Object.assign(slot, { kind, age: 0, delay, radius, damage, fired: false });
    slot.group.position.set(x, 0, z);
    slot.group.visible = true;
    slot.rim.scale.setScalar(radius);
    slot.fill.scale.setScalar(0.01);
    slot.spire.visible = false;
    slot.spire.scale.set(1, 0.01, 1);
    slot.rim.material.color.setHex(kind === 'shadow' ? 0xbd7cfa : 0xef657c);
    slot.fill.material.color.copy(slot.rim.material.color);
  }
  update(dt: number, player: Player) {
    let struck = false;
    for (const slot of this.slots) {
      if (!slot.group.visible) continue;
      slot.age += dt;
      const progress = Math.min(1, slot.age / slot.delay);
      slot.fill.scale.setScalar(slot.radius * Math.max(0.01, progress));
      slot.rim.material.opacity = 0.5 + progress * 0.4;
      slot.fill.material.opacity = 0.08 + progress * 0.15;
      if (slot.age >= slot.delay && !slot.fired) {
        slot.fired = true;
        const { x, z } = slot.group.position;
        if (
          Math.hypot(player.position.x - x, player.position.z - z) <=
          slot.radius + PLAYER.radius
        ) {
          const result = player.takeDamage(slot.damage, x, z, slot.kind === 'spire');
          if (result !== 'miss') this.onDamage(result === 'blocked');
        }
        this.effects.burst(x, 0.2, z, slot.kind === 'spire' ? 0xd58fac : 0xa18ce3, 9, 3);
        struck = true;
      }
      if (slot.fired) {
        const after = slot.age - slot.delay;
        slot.spire.visible = slot.kind === 'spire';
        slot.spire.scale.y = Math.max(0.01, Math.min(1, after / 0.1, (0.7 - after) / 0.35));
        slot.fill.material.opacity = Math.max(0, 0.32 * (1 - after / 0.7));
        slot.rim.material.opacity = Math.max(0, 0.8 * (1 - after / 0.7));
        if (after >= 0.7) slot.group.visible = false;
      }
    }
    // Simultaneous spires share one impact sound.
    if (struck) {
      this.audio.play('graveMark');
      this.onImpact();
    }
  }
  reset() {
    for (const slot of this.slots) {
      slot.group.visible = false;
      slot.fired = false;
      slot.age = 0;
    }
  }
}
