import * as THREE from 'three';
import type { Player } from '../player/Player';
import type { Enemy } from '../enemies/Enemy';
import type { CollisionSystem } from '../game/CollisionSystem';
import type { Effects } from '../world/Effects';
import type { AudioManager } from '../audio/AudioManager';
import type { RobotAssets } from '../player/RobotAssets';
import { isFieldSanctuary } from '../world/GreenfieldsConfig';
export const DISCIPLINES = {
  stormblade: {
    name: 'Stormblade',
    ability: 'Chain lightning',
    cost: 38,
    cooldown: 7,
    description:
      'Strike up to three nearby creatures with a short chain of lightning. Limited reach leaves you close to danger.',
  },
  bulwark: {
    name: 'Bulwark',
    ability: 'Stored shockwave',
    cost: 26,
    cooldown: 6,
    description:
      'Raise your guard just before a hit to store one charge. Release it to stagger nearby creatures; holding guard does not charge it.',
  },
  wispkeeper: {
    name: 'Wispkeeper',
    ability: 'Wisp distraction',
    cost: 30,
    cooldown: 10,
    description:
      'Send a small drone to interrupt and distract one creature for 2.6 seconds. Your next hit ends the distraction.',
  },
} as const;
export type Discipline = keyof typeof DISCIPLINES;
export function validDiscipline(value: unknown): Discipline | null {
  return typeof value === 'string' && Object.hasOwn(DISCIPLINES, value)
    ? (value as Discipline)
    : null;
}
/** Samples the same physical obstacles used by movement, so abilities cannot pass through walls. */
export function clearAbilityPath(collision: CollisionSystem, a: THREE.Vector3, b: THREE.Vector3) {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.2);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (collision.blocked(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0.06)) return false;
  }
  return true;
}
export class DisciplineAbilities {
  group = new THREE.Group();
  private drone: THREE.Group;
  private target?: Enemy;
  private life = 0;
  private bolts: THREE.Line;
  private boltLife = 0;
  constructor(assets: RobotAssets) {
    this.drone = assets.clone('wisp_drone');
    this.drone.visible = false;
    this.group.add(this.drone);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 19), 3));
    geometry.setDrawRange(0, 0);
    this.bolts = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color: 0xa5ecff, transparent: true, opacity: 0 }),
    );
    this.bolts.frustumCulled = false;
    this.group.add(this.bolts);
  }
  activate(
    player: Player,
    enemies: Enemy[],
    collision: CollisionSystem,
    effects: Effects,
    audio: AudioManager,
  ) {
    const selected = player.discipline;
    if (!selected || player.health <= 0)
      return 'Choose a discipline at the restored Firstlight well.';
    if (isFieldSanctuary(player.position.x, player.position.z))
      return 'The sanctuary is a place to rest. Use your ability beyond the walls.';
    if (player.abilityCooldown > 0) return 'Your ability is still recovering.';
    if (player.attackTimer > 0 || player.dodgeTimer > 0 || player.blocking)
      return 'Finish your strike, evade, or guard first.';
    const data = DISCIPLINES[selected];
    if (player.stamina < data.cost) return `Needs ${data.cost} energy.`;
    if (selected === 'bulwark' && !player.parryCharge)
      return 'Time a frontal guard just before impact to store a charge.';
    const range = selected === 'stormblade' ? 5.5 : selected === 'bulwark' ? 4.5 : 8;
    const eligible = enemies.filter(
      (enemy) => enemy.health > 0 && !isFieldSanctuary(enemy.position.x, enemy.position.z),
    );
    const nearby = eligible
      .filter(
        (enemy) =>
          enemy.position.distanceTo(player.position) <= range &&
          clearAbilityPath(collision, player.position, enemy.position),
      )
      .sort(
        (a, b) =>
          a.position.distanceToSquared(player.position) -
          b.position.distanceToSquared(player.position),
      );
    if (!nearby.length) return 'No creature in clear reach.';
    player.stamina -= data.cost;
    player.abilityCooldown = data.cooldown;
    audio.play(selected === 'bulwark' ? 'heavy' : 'block');
    if (selected === 'wispkeeper') {
      this.target = nearby[0];
      this.target.distracted = this.life = 2.6;
      this.target.state = 'recover';
      this.target.timer = 0.5;
      this.drone.position.copy(player.position).add(new THREE.Vector3(0, 2.5, 0));
      this.drone.visible = true;
      return 'Wisp deployed · strike to end its distraction.';
    }
    if (selected === 'bulwark') {
      player.parryCharge = false;
      for (const enemy of nearby) {
        enemy.receiveDamage(24, player);
        if (enemy.health > 0) enemy.timer = 1.4;
      }
      effects.ripple(player.position.x, player.position.z, 4.5);
      effects.burst(player.position.x, 0.5, player.position.z, 0xffd798, 32, 5);
      return 'Stored shockwave released.';
    }
    const chain: Enemy[] = [nearby[0]];
    while (chain.length < 3) {
      const last = chain[chain.length - 1];
      const next = eligible
        .filter(
          (enemy) =>
            !chain.includes(enemy) &&
            enemy.position.distanceTo(last.position) < 4 &&
            clearAbilityPath(collision, last.position, enemy.position),
        )
        .sort(
          (a, b) =>
            a.position.distanceToSquared(last.position) -
            b.position.distanceToSquared(last.position),
        )[0];
      if (!next) break;
      chain.push(next);
    }
    const points = this.bolts.geometry.attributes.position as THREE.BufferAttribute;
    let start = player.position,
      index = 0;
    points.setXYZ(index++, start.x, start.y + 1.3, start.z);
    for (const enemy of chain) {
      const end = enemy.position.clone();
      for (let j = 1; j <= 6; j++) {
        const t = j / 6,
          jitter = j === 6 ? 0 : j % 2 ? 0.2 : -0.2;
        points.setXYZ(
          index++,
          start.x + (end.x - start.x) * t + jitter,
          start.y + (end.y - start.y) * t + 1.3 + jitter,
          start.z + (end.z - start.z) * t,
        );
      }
      enemy.receiveDamage(42, player);
      start = end;
    }
    points.needsUpdate = true;
    this.bolts.geometry.setDrawRange(0, index);
    this.boltLife = 0.3;
    return `Chain lightning · ${chain.length} creature${chain.length === 1 ? '' : 's'} struck.`;
  }
  update(dt: number, time: number, player: Player) {
    this.boltLife = Math.max(0, this.boltLife - dt);
    (this.bolts.material as THREE.LineBasicMaterial).opacity = this.boltLife / 0.3;
    this.life = Math.max(0, this.life - dt);
    if (
      player.health <= 0 ||
      isFieldSanctuary(player.position.x, player.position.z) ||
      !this.target?.distracted ||
      !this.target.health
    )
      this.life = 0;
    this.drone.visible = this.life > 0;
    if (this.drone.visible && this.target) {
      const target = this.target.position
        .clone()
        .add(
          new THREE.Vector3(
            Math.sin(time * 3) * 0.8,
            2.7 + Math.sin(time * 5) * 0.1,
            Math.cos(time * 3) * 0.8,
          ),
        );
      this.drone.position.lerp(target, 1 - Math.exp(-dt * 14));
      this.drone.lookAt(
        this.target.position.x,
        this.target.position.y + 1.5,
        this.target.position.z,
      );
    } else if (this.target) {
      this.target.distracted = 0;
      this.target = undefined;
    }
  }
  reset() {
    if (this.target) this.target.distracted = 0;
    this.target = undefined;
    this.life = this.boltLife = 0;
    this.drone.visible = false;
    (this.bolts.material as THREE.LineBasicMaterial).opacity = 0;
  }
}
