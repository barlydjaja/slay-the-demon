import * as THREE from 'three';
import { SpiderModel } from './CreatureModels';
import { BOSS, BOSS_AGGRO_DISTANCE, PLAYER } from '../game/config';
import { CollisionSystem } from '../game/CollisionSystem';
import { Effects, CharacterReflection } from '../world/Effects';
import { Player } from '../player/Player';
import { AudioManager } from '../audio/AudioManager';
import { angleDamp, clamp, inAttackArc } from '../game/math';
import {
  BOSS_ATTACKS,
  chooseBossAttack,
  canBossAggro,
  type BossState,
  type AttackKind,
} from './BossAI';
export class Boss {
  model = new SpiderModel(true);
  state: BossState = 'idle';
  health: number = BOSS.health;
  timer = 0;
  attackKind: AttackKind = 'slash';
  attackIndex = 0;
  deadTime = 0;
  lastHit = -1;
  reflection: CharacterReflection;
  telegraphs = new THREE.Group();
  private indicators = new Map<AttackKind, THREE.Group>();
  private damageDone = false;
  private targetAngle = 0;
  private stepTimer = 0;
  onAggro = () => {};
  onDamage = (blocked: boolean) => {};
  onDeath = () => {};
  constructor(
    private collision: CollisionSystem,
    private effects: Effects,
    private audio: AudioManager,
  ) {
    this.position.set(0, 0, BOSS.spawnZ);
    this.model.group.rotation.y = 0;
    for (const kind of ['slash', 'heavy', 'lunge', 'sweep'] as AttackKind[]) {
      const group = new THREE.Group(),
        data = BOSS_ATTACKS[kind],
        circle = kind === 'sweep';
      const start = circle ? 0 : -Math.PI / 2 - 1.03,
        length = circle ? Math.PI * 2 : 2.06;
      const mat = new THREE.MeshBasicMaterial({
        color: kind === 'heavy' || kind === 'sweep' ? 0xe56871 : 0xdba67b,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(data.range - 0.12, data.range, 64, 1, start, length),
        mat,
      );
      ring.rotation.x = -Math.PI / 2;
      group.add(ring);
      const fill = new THREE.Mesh(
        new THREE.CircleGeometry(data.range, 48, start, length),
        new THREE.MeshBasicMaterial({
          color: 0xa84556,
          transparent: true,
          opacity: 0.085,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      fill.rotation.x = -Math.PI / 2;
      group.add(fill);
      group.visible = false;
      this.indicators.set(kind, group);
      this.telegraphs.add(group);
    }
    this.telegraphs.position.y = 0.075;
    this.reflection = new CharacterReflection(this.model.group, 0x72829e, 0.12);
  }
  get position() {
    return this.model.group.position;
  }
  get active() {
    return this.state !== 'idle' && this.state !== 'dead';
  }
  get tell() {
    return this.state === 'prepare'
      ? BOSS_ATTACKS[this.attackKind].name
      : this.state === 'recover'
        ? 'RECOVERING · STRIKE NOW'
        : this.state === 'wake'
          ? 'AN ANCIENT EVIL AWAKENS'
          : '';
  }
  update(dt: number, time: number, player: Player) {
    this.timer -= dt;
    const dx = player.position.x - this.position.x,
      dz = player.position.z - this.position.z,
      distance = Math.hypot(dx, dz),
      angle = Math.atan2(dx, dz);
    let moving = false,
      windup = 0,
      attack = 0;
    if (this.state === 'dead') {
      this.deadTime += dt;
      this.model.animate(time, false, 0, 0, this.deadTime * 0.5);
      this.telegraphs.visible = false;
      this.reflection.update(this.position.x, this.position.z, this.deadTime < 4);
      return;
    }
    if (this.state === 'idle') {
      if (canBossAggro(distance, player.health, BOSS_AGGRO_DISTANCE)) {
        this.state = 'wake';
        this.timer = 2.7;
        this.audio.setBoss(true);
        this.onAggro();
      }
    } else if (this.state === 'wake') {
      windup = 1;
      this.model.group.rotation.y = angleDamp(this.model.group.rotation.y, angle, 2, dt);
      if (this.timer <= 0) {
        this.state = 'chase';
        this.timer = 0.6;
      }
    } else if (this.state === 'chase') {
      this.model.group.rotation.y = angleDamp(this.model.group.rotation.y, angle, 3.2, dt);
      if ((distance < 6.1 && this.timer <= 0) || (distance > 9 && this.timer < -1.3))
        this.prepare(chooseBossAttack(this.attackIndex++, distance), angle);
      else {
        const speed = BOSS.speed * (this.health < BOSS.health * 0.5 ? 1.2 : 1);
        this.move((dx / (distance || 1)) * speed * dt, (dz / (distance || 1)) * speed * dt);
        moving = true;
      }
    } else if (this.state === 'prepare') {
      const data = BOSS_ATTACKS[this.attackKind];
      windup = 1 - this.timer / data.windup;
      // Lock aim in the last half of preparation so tells remain dodgeable.
      if (windup < 0.5) {
        this.targetAngle = angle;
        this.model.group.rotation.y = angleDamp(this.model.group.rotation.y, angle, 3, dt);
      }
      if (this.timer <= 0) {
        this.state = 'attack';
        this.timer = data.duration;
        this.damageDone = false;
        this.audio.play('heavy');
      }
    } else if (this.state === 'attack') {
      const data = BOSS_ATTACKS[this.attackKind];
      attack = 1 - this.timer / data.duration;
      if (this.attackKind === 'lunge') {
        this.move(Math.sin(this.targetAngle) * dt * 17, Math.cos(this.targetAngle) * dt * 17);
        moving = true;
      }
      if (!this.damageDone) {
        const near =
          this.attackKind === 'sweep'
            ? distance < data.range
            : inAttackArc(
                this.position.x,
                this.position.z,
                this.targetAngle,
                player.position.x,
                player.position.z,
                data.range,
                1.2,
              );
        if (near) {
          const result = player.takeDamage(
            data.damage,
            this.position.x,
            this.position.z,
            data.heavy,
          );
          if (result !== 'miss') {
            this.damageDone = true;
            this.onDamage(result === 'blocked');
            if (result === 'blocked' && !data.heavy) this.timer = 0;
          }
        }
      }
      if (this.timer <= 0) {
        this.state = 'recover';
        this.timer = data.recovery;
        this.effects.splash(this.position.x, this.position.z, 4);
      }
    } else if (this.state === 'recover') {
      if (this.timer <= 0) {
        this.state = 'reposition';
        this.timer = 1.05;
      }
    } else if (this.state === 'reposition') {
      const side = this.attackIndex % 2 ? 1 : -1;
      this.move(
        (Math.cos(angle) * side - Math.sin(angle) * 0.45) * dt * 2.1,
        (-Math.sin(angle) * side - Math.cos(angle) * 0.45) * dt * 2.1,
      );
      moving = true;
      this.model.group.rotation.y = angleDamp(this.model.group.rotation.y, angle, 2, dt);
      if (this.timer <= 0) {
        this.state = 'chase';
        this.timer = 0.1;
      }
    }
    this.model.animate(time, moving, windup, attack);
    this.telegraphs.position.set(this.position.x, 0.075, this.position.z);
    this.telegraphs.rotation.y = this.targetAngle;
    for (const [kind, group] of this.indicators) {
      group.visible =
        kind === this.attackKind && (this.state === 'prepare' || this.state === 'attack');
      if (group.visible) {
        const scale = this.state === 'attack' ? 1 : 0.91 + windup * 0.09;
        group.scale.setScalar(scale);
        (
          group.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
        ).material.opacity = 0.3 + Math.sin(time * 13) * 0.12 + windup * 0.3;
      }
    }
    if (moving) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.22;
        const side = Math.sin(time * 6) > 0 ? 1 : -1;
        this.effects.splash(
          this.position.x + side * 3.3,
          this.position.z + Math.sin(time * 4) * 2,
          1.7,
        );
      }
    }
    this.reflection.update(this.position.x, this.position.z);
    // Physical body separation keeps the robot outside the spider abdomen.
    if (distance < 2.25 && distance > 0.01 && this.active) {
      this.collision.move(
        player.position,
        (dx / distance) * (2.25 - distance),
        (dz / distance) * (2.25 - distance),
        PLAYER.radius,
      );
    }
  }
  private prepare(kind: AttackKind, angle: number) {
    this.attackKind = kind;
    this.targetAngle = angle;
    this.state = 'prepare';
    this.timer = BOSS_ATTACKS[kind].windup;
    this.audio.play('telegraph');
  }
  private move(dx: number, dz: number) {
    this.collision.move(this.position, dx, dz, BOSS.radius);
    this.position.x = clamp(this.position.x, -9.5, 9.5);
    this.position.z = clamp(this.position.z, -147, -120);
  }
  tryHit(player: Player) {
    if (
      !this.active ||
      this.state === 'wake' ||
      !player.hitWindow ||
      this.lastHit === player.attackId
    )
      return false;
    if (
      !inAttackArc(
        player.position.x,
        player.position.z,
        player.facing,
        this.position.x,
        this.position.z,
        PLAYER.attackRange + 2,
      )
    )
      return false;
    this.lastHit = player.attackId;
    this.health = Math.max(0, this.health - PLAYER.damage);
    this.audio.play('hit');
    this.effects.burst(player.position.x, 1.4, player.position.z, 0xda9bac, 19, 4);
    if (this.health <= 0) {
      this.state = 'dead';
      this.deadTime = 0;
      this.audio.setBoss(false);
      this.audio.play('death');
      this.onDeath();
    }
    return true;
  }
  reset() {
    this.state = 'idle';
    this.health = BOSS.health;
    this.timer = 0;
    this.deadTime = 0;
    this.lastHit = -1;
    this.attackIndex = 0;
    this.position.set(0, 0, BOSS.spawnZ);
    this.model.group.rotation.set(0, 0, 0);
    this.model.torso.rotation.set(0, 0, 0);
    this.model.body.position.y = 0;
    this.telegraphs.visible = true;
    for (const group of this.indicators.values()) group.visible = false;
    this.audio.setBoss(false);
  }
}
