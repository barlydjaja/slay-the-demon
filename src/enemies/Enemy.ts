import * as THREE from 'three';
import { ArmorModel, SpiderModel } from './CreatureModels';
import { CollisionSystem } from '../game/CollisionSystem';
import { Player } from '../player/Player';
import { Effects } from '../world/Effects';
import { AudioManager } from '../audio/AudioManager';
import { angleDamp, inAttackArc } from '../game/math';
import { PLAYER } from '../game/config';
import { FieldCreatureModel } from './FieldCreatureModel';
import { isFieldSanctuary, type FieldMonster } from '../world/GreenfieldsConfig';
export const ENEMY_PROFILES = {
  armor: { health: 96, speed: 2.35, range: 2.1, windup: 0.75, damage: 15, height: 3.55 },
  spider: { health: 64, speed: 4.15, range: 1.5, windup: 0.5, damage: 10, height: 1.7 },
  wolf: { health: 96, speed: 4.7, range: 1.65, windup: 0.55, damage: 13, height: 2.2 },
  golem: { health: 224, speed: 1.9, range: 2.3, windup: 1.15, damage: 27, height: 3.5 },
  thornling: { health: 64, speed: 2.8, range: 1.7, windup: 0.7, damage: 12, height: 2.6 },
} as const;
export type EnemyState = 'patrol' | 'chase' | 'prepare' | 'attack' | 'recover' | 'dead';
export class Enemy {
  model: ArmorModel | SpiderModel | FieldCreatureModel;
  private profile: (typeof ENEMY_PROFILES)[keyof typeof ENEMY_PROFILES];
  state: EnemyState = 'patrol';
  health: number;
  maxHealth: number;
  timer = 0;
  deadTime = 0;
  lastHit = -1;
  private origin = new THREE.Vector3();
  private phase: number;
  private bar: THREE.Mesh;
  private barGroup = new THREE.Group();
  constructor(
    public type: 'armor' | 'spider' | FieldMonster,
    public zone: number,
    x: number,
    z: number,
    private collision: CollisionSystem,
    private effects: Effects,
    private audio: AudioManager,
    template?: THREE.Group,
  ) {
    this.profile = ENEMY_PROFILES[type];
    this.model =
      type === 'armor'
        ? new ArmorModel(template)
        : type === 'spider'
          ? new SpiderModel(template)
          : new FieldCreatureModel(type, template);
    this.model.group.position.set(x, this.collision.heightAt(x, z), z);
    this.origin.copy(this.model.group.position);
    this.maxHealth = this.health = this.profile.health;
    this.phase = x * 7 + z;
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.08),
      new THREE.MeshBasicMaterial({ color: 0x18252a, depthTest: false }),
    );
    this.barGroup.add(back);
    this.bar = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 0.035),
      new THREE.MeshBasicMaterial({ color: 0xb09b78, depthTest: false }),
    );
    this.bar.position.z = 0.003;
    this.barGroup.add(this.bar);
    this.barGroup.position.y = this.profile.height;
    this.model.group.add(this.barGroup);
    this.barGroup.visible = false;
  }
  get position() {
    return this.model.group.position;
  }
  update(dt: number, time: number, player: Player, camera: THREE.Camera) {
    if (this.state === 'dead') {
      this.deadTime += dt;
      this.model.animate(time, false, 0, 0, this.deadTime);
      if (this.deadTime > 1.5)
        this.model.group.position.y =
          this.collision.heightAt(this.position.x, this.position.z) -
          Math.min(2, (this.deadTime - 1.5) * 0.8);
      if (this.deadTime > 4) this.model.group.visible = false;
      return;
    }
    const dx = player.position.x - this.position.x,
      dz = player.position.z - this.position.z,
      distance = Math.hypot(dx, dz),
      range = this.profile.range;
    // The elder's clearing and Firstlight are sanctuaries. Cancel telegraphed
    // attacks immediately and return to the spawn if the player seeks shelter.
    if (
      this.zone === 5 &&
      (isFieldSanctuary(player.position.x, player.position.z) ||
        this.position.distanceToSquared(this.origin) > 11 ** 2)
    ) {
      this.state = 'patrol';
      this.timer = 0;
      const homeX = this.origin.x - this.position.x,
        homeZ = this.origin.z - this.position.z;
      const homeDistance = Math.hypot(homeX, homeZ);
      if (homeDistance > 0.15) {
        this.collision.move(
          this.position,
          (homeX / homeDistance) * dt * this.profile.speed,
          (homeZ / homeDistance) * dt * this.profile.speed,
          0.5,
        );
        this.model.group.rotation.y = angleDamp(
          this.model.group.rotation.y,
          Math.atan2(homeX, homeZ),
          5,
          dt,
        );
      }
      this.model.animate(time, homeDistance > 0.15, 0, 0);
      this.barGroup.visible = false;
      return;
    }
    this.timer -= dt;
    let moving = false,
      windup = 0,
      attack = 0;
    if (this.state === 'patrol') {
      if (distance < 8 && player.health > 0) {
        this.state = 'chase';
        this.timer = 0;
      } else {
        const tx = this.origin.x + Math.sin(time * 0.5 + this.phase) * 1.2,
          tz = this.origin.z + Math.cos(time * 0.4 + this.phase) * 1.2;
        const ax = tx - this.position.x,
          az = tz - this.position.z;
        this.collision.move(this.position, ax * dt * 0.55, az * dt * 0.55, 0.5);
        moving = true;
        this.model.group.rotation.y = angleDamp(
          this.model.group.rotation.y,
          Math.atan2(ax, az),
          3,
          dt,
        );
      }
    } else if (this.state === 'chase') {
      this.model.group.rotation.y = angleDamp(
        this.model.group.rotation.y,
        Math.atan2(dx, dz),
        9,
        dt,
      );
      if (distance > 15 || player.health <= 0) this.state = 'patrol';
      else if (distance < range + 0.4 && this.timer <= 0) {
        this.state = 'prepare';
        this.timer = this.profile.windup;
      } else if (distance > range * 0.8) {
        const speed = this.profile.speed;
        this.collision.move(
          this.position,
          (dx / (distance || 1)) * dt * speed,
          (dz / (distance || 1)) * dt * speed,
          0.5,
        );
        moving = true;
      }
    } else if (this.state === 'prepare') {
      windup = 1 - this.timer / this.profile.windup;
      if (this.timer <= 0) {
        this.state = 'attack';
        this.timer = 0.21;
        if (distance < range + 0.5) {
          const result = player.takeDamage(this.profile.damage, this.position.x, this.position.z);
          if (result === 'blocked') {
            this.state = 'recover';
            this.timer = 1.5;
          }
        }
      }
    } else if (this.state === 'attack') {
      attack = 1;
      if (this.timer <= 0) {
        this.state = 'recover';
        this.timer = this.type === 'armor' ? 0.9 : 1;
      }
    } else if (this.state === 'recover') {
      if ((this.type === 'spider' || this.type === 'wolf') && distance < 3) {
        this.collision.move(
          this.position,
          (-dx / (distance || 1)) * dt * 2,
          (-dz / (distance || 1)) * dt * 2,
          0.45,
        );
        moving = true;
      }
      if (this.timer <= 0) this.state = 'chase';
    }
    this.model.animate(time, moving, windup, attack);
    this.barGroup.visible = this.health < this.maxHealth || this.state === 'prepare';
    this.bar.scale.x = Math.max(0, this.health / this.maxHealth);
    this.bar.position.x = -(1 - this.health / this.maxHealth) * 0.5;
    this.barGroup.quaternion.copy(camera.quaternion);
    this.barGroup.rotateY(-this.model.group.rotation.y);
    if (distance < 0.98 && distance > 0.001)
      this.collision.move(
        this.position,
        (-dx / distance) * dt * 3,
        (-dz / distance) * dt * 3,
        0.45,
      );
  }
  tryHit(player: Player) {
    if (this.state === 'dead' || !player.hitWindow || this.lastHit === player.attackId)
      return false;
    if (
      !inAttackArc(
        player.position.x,
        player.position.z,
        player.facing,
        this.position.x,
        this.position.z,
        PLAYER.attackRange + 0.35,
      )
    )
      return false;
    this.lastHit = player.attackId;
    this.health = Math.max(0, this.health - PLAYER.damage);
    this.effects.burst(this.position.x, 1, this.position.z, 0xc5b28d, 14, 4);
    this.audio.play('hit');
    this.state = this.health === 0 ? 'dead' : 'recover';
    this.timer = 0.55;
    const dx = this.position.x - player.position.x,
      dz = this.position.z - player.position.z,
      len = Math.hypot(dx, dz) || 1;
    this.collision.move(this.position, (dx / len) * 0.35, (dz / len) * 0.35, 0.5);
    if (this.health === 0) {
      player.health = Math.min(100, player.health + 5);
      this.barGroup.visible = false;
      this.effects.burst(this.position.x, 0.7, this.position.z, 0x849ab3, 18, 2);
    }
    return true;
  }
  reset() {
    this.state = 'patrol';
    this.health = this.maxHealth;
    this.timer = 0;
    this.deadTime = 0;
    this.lastHit = -1;
    this.position.copy(this.origin);
    this.model.group.rotation.set(0, 0, 0);
    this.model.group.visible = true;
  }
}
