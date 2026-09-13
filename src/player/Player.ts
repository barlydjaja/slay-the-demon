import * as THREE from 'three';
import type { Discipline } from '../combat/Disciplines';
import { PLAYER } from '../game/config';
import { InputManager } from '../game/InputManager';
import { CollisionSystem } from '../game/CollisionSystem';
import { angleDamp, clamp } from '../game/math';
import { Effects } from '../world/Effects';
import { AudioManager } from '../audio/AudioManager';
import { RobotAssets } from './RobotAssets';
import { RobotModel } from './RobotModel';
export class Player {
  model: RobotModel;
  position: THREE.Vector3;
  discipline: Discipline | null = null;
  abilityCooldown = 0;
  parryCharge = false;
  private guardAge = Infinity;
  health = 100;
  stamina = 100;
  maxStamina = 100;
  facing = Math.PI;
  attackTimer = 0;
  attackId = 0;
  hitWindow = false;
  blocking = false;
  moving = false;
  sprinting = false;
  deadTime = 0;
  hitTimer = 0;
  invulnerable = 0;
  dodgeTimer = 0;
  dodgeCooldown = 0;
  private dodgeX = 0;
  private dodgeZ = -1;
  private footsteps = 0;
  private attackResolved = false;
  constructor(
    private collision: CollisionSystem,
    private effects: Effects,
    private audio: AudioManager,
    assets: RobotAssets,
  ) {
    this.model = new RobotModel(assets.clone('robot'));
    this.position = this.model.group.position;
    this.position.set(0, 0, 11);
  }
  update(dt: number, time: number, input: InputManager, aim: THREE.Vector3 | null) {
    this.abilityCooldown = Math.max(0, this.abilityCooldown - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.hitTimer = Math.max(0, this.hitTimer - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    if (this.health <= 0) {
      this.hitWindow = false;
      this.deadTime += dt;
      this.model.animate(time, false, false, 0, false, 0, this.deadTime);
      return;
    }
    this.hitWindow = false;
    if (this.attackTimer > 0) {
      this.attackTimer = Math.max(0, this.attackTimer - dt);
      if (!this.attackResolved && this.attackTimer < 0.3) {
        this.hitWindow = true;
        this.attackResolved = true;
      }
    }
    const wasBlocking = this.blocking;
    this.blocking =
      input.block && this.attackTimer <= 0 && this.stamina > 4 && this.dodgeTimer <= 0;
    this.guardAge = this.blocking ? (wasBlocking ? this.guardAge + dt : 0) : Infinity;
    const horizontal =
      Number(input.down('KeyD', 'ArrowRight')) - Number(input.down('KeyA', 'ArrowLeft'));
    const vertical =
      Number(input.down('KeyS', 'ArrowDown')) - Number(input.down('KeyW', 'ArrowUp'));
    // Movement is relative to the fixed camera, so W always moves up the screen.
    let dx = horizontal * 0.846 + vertical * 0.533,
      dz = vertical * 0.846 - horizontal * 0.533;
    const len = Math.hypot(dx, dz);
    if (len) {
      dx /= len;
      dz /= len;
    }
    this.moving = len > 0;
    this.sprinting =
      this.moving &&
      input.down('ShiftLeft', 'ShiftRight') &&
      this.stamina > 0 &&
      !this.blocking &&
      this.attackTimer === 0;
    if (input.consume('Space') && this.dodgeCooldown <= 0 && this.stamina >= 22 && !this.blocking) {
      this.dodgeTimer = PLAYER.dodgeDuration;
      this.dodgeCooldown = PLAYER.dodgeCooldown;
      this.stamina -= 22;
      this.invulnerable = 0.3;
      this.dodgeX = len ? dx : Math.sin(this.facing);
      this.dodgeZ = len ? dz : Math.cos(this.facing);
      this.audio.play('dodge');
    }
    if (aim && (input.attack || this.blocking)) {
      const ax = aim.x - this.position.x,
        az = aim.z - this.position.z;
      if (Math.hypot(ax, az) > 0.2) this.facing = Math.atan2(ax, az);
    } else if (this.moving && this.attackTimer === 0) this.facing = Math.atan2(dx, dz);
    if (input.attack && !this.blocking && this.attackTimer === 0 && this.dodgeTimer <= 0) {
      this.attackTimer = PLAYER.attackDuration;
      this.attackId++;
      this.attackResolved = false;
      this.audio.play('swing');
    }
    let speed: number = this.sprinting ? PLAYER.sprintSpeed : PLAYER.speed;
    if (this.blocking) speed *= 0.46;
    if (this.attackTimer > 0) speed *= 0.55;
    if (this.dodgeTimer > 0) {
      this.dodgeTimer -= dt;
      dx = this.dodgeX;
      dz = this.dodgeZ;
      speed = 15;
    }
    this.collision.move(this.position, dx * speed * dt, dz * speed * dt, PLAYER.radius);
    this.stamina = clamp(
      this.stamina + dt * (this.sprinting ? -24 : this.blocking ? 9 : 26),
      0,
      this.maxStamina,
    );
    this.model.group.rotation.y = angleDamp(this.model.group.rotation.y, this.facing, 22, dt);
    this.model.animate(
      time,
      this.moving,
      this.sprinting,
      this.attackTimer,
      this.blocking,
      this.hitTimer,
      0,
    );
    this.model.body.rotation.z =
      this.dodgeTimer > 0 ? Math.sin((this.dodgeTimer / PLAYER.dodgeDuration) * Math.PI) * 0.3 : 0;
    if (this.moving) {
      this.footsteps -= dt;
      if (this.footsteps < 0) {
        this.footsteps = this.sprinting ? 0.21 : 0.32;
        this.effects.splash(this.position.x, this.position.z, 0.55);
        this.audio.play('step');
      }
    }
  }
  takeDamage(
    amount: number,
    fromX: number,
    fromZ: number,
    heavy = false,
  ): 'blocked' | 'hurt' | 'miss' {
    if (this.health <= 0 || this.invulnerable > 0) return 'miss';
    const angle = Math.atan2(fromX - this.position.x, fromZ - this.position.z);
    const front = Math.cos(angle - this.facing) > -0.15;
    if (this.blocking && front && this.stamina >= (heavy ? 24 : 12)) {
      if (this.discipline === 'bulwark' && this.guardAge <= 0.22) {
        this.parryCharge = true;
        this.guardAge = Infinity;
      }
      this.stamina -= heavy ? 24 : 12;
      this.invulnerable = 0.18;
      this.effects.burst(this.position.x, 0.95, this.position.z, 0xe4e8c6, 20, 4);
      this.audio.play('block');
      if (heavy) this.health = Math.max(0, this.health - Math.round(amount * 0.15));
      return 'blocked';
    }
    this.health = Math.max(0, this.health - amount);
    this.hitTimer = 0.28;
    this.invulnerable = 0.5;
    this.effects.burst(this.position.x, 1, this.position.z, 0x76c0d6, 14, 3);
    this.audio.play(this.health <= 0 ? 'death' : 'hurt');
    const dx = this.position.x - fromX,
      dz = this.position.z - fromZ,
      len = Math.hypot(dx, dz) || 1;
    this.collision.move(this.position, (dx / len) * 0.5, (dz / len) * 0.5, PLAYER.radius);
    return 'hurt';
  }
  chooseDiscipline(discipline: Discipline) {
    if (this.discipline === discipline) return;
    this.discipline = discipline;
    this.parryCharge = false;
  }
  reset(z = 11, x = 0) {
    this.abilityCooldown = 0;
    this.parryCharge = false;
    this.guardAge = Infinity;
    this.position.set(x, this.collision.heightAt(x, z), z);
    this.health = 100;
    this.stamina = this.maxStamina;
    this.deadTime = 0;
    this.attackTimer = 0;
    this.dodgeTimer = 0;
    this.dodgeCooldown = 0;
    this.blocking = false;
    this.hitWindow = false;
    this.hitTimer = 0;
    this.invulnerable = 1;
    this.facing = Math.PI;
    this.model.group.rotation.set(0, Math.PI, 0);
  }
}
