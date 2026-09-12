import * as THREE from 'three';
import { ReaperModel } from './CreatureModels';
import { BossHazards } from './BossHazards';
import type { CastleCreatureAssets } from './CastleCreatureAssets';
import { BOSS, BOSS_AGGRO_DISTANCE, PLAYER } from '../game/config';
import { CollisionSystem } from '../game/CollisionSystem';
import { Effects } from '../world/Effects';
import { Player } from '../player/Player';
import { AudioManager } from '../audio/AudioManager';
import { angleDamp, clamp, inAttackArc } from '../game/math';
import {
  BOSS_ATTACKS,
  REAPING_BEATS,
  RUSH,
  SOUL_RING,
  attackDuration,
  chooseBossAttack,
  canBossAggro,
  distanceToSegmentSquared,
  type BossState,
  type AttackKind,
} from './BossAI';

export class Boss {
  readonly model: ReaperModel;
  readonly hazards: BossHazards;
  state: BossState = 'idle';
  phase = 1;
  health: number = BOSS.health;
  timer = 0;
  attackKind: AttackKind = 'slash';
  attackIndex = 0;
  deadTime = 0;
  lastHit = -1;
  readonly telegraphs = new THREE.Group();
  private aimTells = new THREE.Group();
  private indicators = new Map<AttackKind, THREE.Group>();
  private wave: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private damageDone = false;
  private beatsDone = 0;
  private marksDone = 0;
  private targetAngle = 0;
  private stepTimer = 0;
  onAggro = () => {};
  onPhase = () => {};
  onImpact = () => {};
  onDamage = (blocked: boolean) => {};
  onDeath = () => {};
  constructor(
    private collision: CollisionSystem,
    private effects: Effects,
    private audio: AudioManager,
    assets: CastleCreatureAssets,
  ) {
    this.model = new ReaperModel(assets.clone('reaper'));
    this.position.set(0, 0, BOSS.spawnZ);
    this.hazards = new BossHazards(assets.clone('grave_spire'), effects, audio);
    this.hazards.onDamage = (blocked) => this.onDamage(blocked);
    this.hazards.onImpact = () => this.onImpact();
    this.telegraphs.add(this.aimTells, this.hazards.group);
    for (const kind of ['slash', 'heavy', 'lunge', 'sweep'] as AttackKind[]) {
      const group = new THREE.Group(),
        data = BOSS_ATTACKS[kind];
      const mat = new THREE.MeshBasicMaterial({
        color: kind === 'slash' ? 0xefb882 : 0xf06e92,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        fog: false,
        side: THREE.DoubleSide,
      });
      if (kind === 'lunge') {
        // Rounded lane exactly covers the rushing body's swept collision capsule.
        const shape = new THREE.Shape();
        shape.moveTo(-RUSH.radius, 0);
        shape.lineTo(-RUSH.radius, -(RUSH.end - RUSH.start) * RUSH.speed);
        shape.absarc(
          0,
          -(RUSH.end - RUSH.start) * RUSH.speed,
          RUSH.radius,
          Math.PI,
          Math.PI * 2,
          false,
        );
        shape.lineTo(RUSH.radius, 0);
        shape.absarc(0, 0, RUSH.radius, 0, Math.PI, false);
        const lane = new THREE.Mesh(new THREE.ShapeGeometry(shape, 20), mat);
        lane.rotation.x = -Math.PI / 2;
        group.add(lane);
      } else {
        const start = -Math.PI / 2 - data.halfAngle;
        const length = data.halfAngle * 2;
        const rim = new THREE.Mesh(
          new THREE.RingGeometry(data.range - 0.1, data.range, 64, 1, start, length),
          mat,
        );
        const fill = new THREE.Mesh(
          new THREE.CircleGeometry(data.range, 64, start, length),
          mat.clone(),
        );
        fill.material.opacity = kind === 'sweep' ? 0.035 : 0.1;
        rim.rotation.x = fill.rotation.x = -Math.PI / 2;
        group.add(rim, fill);
      }
      group.visible = false;
      this.indicators.set(kind, group);
      this.aimTells.add(group);
    }
    // Dynamic positions keep the soul ring's visible band at the damage width.
    this.wave = new THREE.Mesh(
      new THREE.RingGeometry(1, 2, 96),
      new THREE.MeshBasicMaterial({
        color: 0xd89aff,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        fog: false,
        side: THREE.DoubleSide,
      }),
    );
    this.wave.rotation.x = -Math.PI / 2;
    this.wave.position.y = 0.11;
    this.wave.visible = false;
    this.telegraphs.add(this.wave);
  }
  get position() {
    return this.model.group.position;
  }
  get active() {
    return this.state !== 'idle' && this.state !== 'dead';
  }
  get tell() {
    if (this.state === 'phase') return 'THE HOLLOW HUNGER · PHASE II';
    if (this.state === 'wake') return 'DO NOT FOLLOW THE VOICES';
    if (this.state === 'recover') return 'RECOVERING · STRIKE NOW';
    if (this.state === 'prepare' || this.state === 'attack')
      return this.attackKind === 'slash' && this.phase === 2
        ? 'REAPING CUTS · THREE STRIKES'
        : BOSS_ATTACKS[this.attackKind].name;
    return this.phase === 2 ? 'THE HOLLOW HUNGER' : '';
  }
  update(dt: number, time: number, player: Player) {
    this.timer -= dt;
    let dx = player.position.x - this.position.x,
      dz = player.position.z - this.position.z;
    const distance = Math.hypot(dx, dz),
      angle = Math.atan2(dx, dz);
    let moving = false,
      windup = 0,
      attack = 0,
      ritual = 0;
    if (this.state === 'dead') {
      this.deadTime += dt;
      this.model.animate(time, false, 0, 0, this.deadTime * 0.5);
      this.clearWarnings();
      return;
    }
    // Finish committed attacks before the phase change; no invisible leftover damage.
    if (
      this.phase === 1 &&
      this.health <= BOSS.health * 0.5 &&
      ['chase', 'reposition', 'recover'].includes(this.state)
    ) {
      this.phase = 2;
      this.state = 'phase';
      this.timer = 2.2;
      this.clearWarnings();
      this.audio.play('reaperScream');
      this.effects.burst(this.position.x, 3.8, this.position.z, 0xb894eb, 38, 5);
      this.onPhase();
    }
    if (this.state === 'idle') {
      if (canBossAggro(distance, player.health, BOSS_AGGRO_DISTANCE)) {
        this.state = 'wake';
        this.timer = 2.7;
        this.audio.setBoss(true);
        this.onAggro();
      }
    } else if (this.state === 'wake' || this.state === 'phase') {
      ritual = Math.sin((Math.PI * Math.max(0, this.timer)) / (this.state === 'wake' ? 2.7 : 2.2));
      this.model.group.rotation.y = angleDamp(this.model.group.rotation.y, angle, 2, dt);
      if (this.timer <= 0) {
        this.state = 'chase';
        this.timer = 0.4;
      }
    } else if (this.state === 'chase') {
      this.model.group.rotation.y = angleDamp(this.model.group.rotation.y, angle, 3.2, dt);
      if ((distance < 6.1 && this.timer <= 0) || (distance > 9 && this.timer < -1.1)) {
        this.prepare(chooseBossAttack(this.attackIndex++, distance), angle);
      } else {
        const speed = BOSS.speed * (this.phase === 2 ? 1.24 : 1);
        this.move((dx / (distance || 1)) * speed * dt, (dz / (distance || 1)) * speed * dt);
        moving = true;
      }
    } else if (this.state === 'prepare') {
      const data = BOSS_ATTACKS[this.attackKind];
      const elapsed = data.windup - this.timer;
      windup = clamp(elapsed / data.windup, 0, 1);
      if (windup < 0.5) this.targetAngle = angle;
      this.model.group.rotation.y = this.targetAngle;
      if (this.attackKind === 'hunt') {
        while (this.marksDone < 3 && elapsed >= this.marksDone * 0.36) {
          this.hazards.spawn(
            'shadow',
            player.position.x,
            player.position.z,
            0.92,
            1.5,
            data.damage,
          );
          this.marksDone++;
        }
      }
      if (this.timer <= 0) {
        this.state = 'attack';
        this.timer = attackDuration(this.attackKind, this.phase);
        this.damageDone = false;
        this.beatsDone = 0;
        if (this.attackKind === 'sweep') this.audio.play('soulRing');
      }
    } else if (this.state === 'attack') {
      const data = BOSS_ATTACKS[this.attackKind];
      const duration = attackDuration(this.attackKind, this.phase);
      const elapsed = duration - this.timer,
        before = Math.max(0, elapsed - dt);
      attack = Math.max(0.001, elapsed);
      if (this.attackKind === 'slash' || this.attackKind === 'heavy') {
        const beats: readonly number[] = this.attackKind === 'heavy' ? [0.32] : REAPING_BEATS;
        const count = this.attackKind === 'heavy' ? 1 : this.phase === 2 ? 3 : 2;
        while (this.beatsDone < count && elapsed >= beats[this.beatsDone]) {
          this.beatsDone++;
          this.audio.play(this.attackKind === 'heavy' ? 'heavy' : 'swing');
          this.onImpact();
          if (
            inAttackArc(
              this.position.x,
              this.position.z,
              this.targetAngle,
              player.position.x,
              player.position.z,
              data.range,
              data.halfAngle,
            )
          )
            this.damage(player);
        }
      } else if (this.attackKind === 'lunge') {
        const travelTime = Math.max(0, Math.min(elapsed, RUSH.end) - Math.max(before, RUSH.start));
        if (travelTime > 0) {
          const oldX = this.position.x,
            oldZ = this.position.z;
          this.move(
            Math.sin(this.targetAngle) * travelTime * RUSH.speed,
            Math.cos(this.targetAngle) * travelTime * RUSH.speed,
          );
          moving = true;
          if (
            !this.damageDone &&
            distanceToSegmentSquared(
              player.position.x,
              player.position.z,
              oldX,
              oldZ,
              this.position.x,
              this.position.z,
            ) <=
              (RUSH.radius + PLAYER.radius) ** 2
          ) {
            this.damage(player);
            this.damageDone = true;
          }
          if (before <= RUSH.start) {
            this.audio.play('heavy');
            this.onImpact();
          }
        }
      } else if (this.attackKind === 'sweep') {
        const radiusAt = (t: number) =>
          SOUL_RING.start + clamp(t / duration, 0, 1) * (data.range - SOUL_RING.start);
        const r0 = radiusAt(before),
          r1 = radiusAt(elapsed);
        const d = this.position.distanceTo(player.position);
        this.setWave(r1);
        if (
          !this.damageDone &&
          d >= r0 - SOUL_RING.width / 2 - PLAYER.radius &&
          d <= r1 + SOUL_RING.width / 2 + PLAYER.radius
        ) {
          this.damage(player);
          this.damageDone = true;
        }
      }
      if (this.timer <= 0) {
        this.state = 'recover';
        this.timer = data.recovery * (this.phase === 2 ? 0.8 : 1);
        this.wave.visible = false;
      }
    } else if (this.state === 'recover') {
      if (this.timer <= 0) {
        this.state = 'reposition';
        this.timer = this.phase === 2 ? 0.55 : 0.85;
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
    this.hazards.update(dt, player);
    this.model.animate(time, moving, windup, attack, 0, this.attackKind, this.phase, ritual);
    // The rush lane remains anchored where the committed attack began.
    if (this.state !== 'attack' || this.attackKind !== 'lunge')
      this.aimTells.position.set(this.position.x, 0.075, this.position.z);
    this.aimTells.rotation.y = this.targetAngle;
    for (const [kind, group] of this.indicators) {
      group.visible =
        kind === this.attackKind &&
        (this.state === 'prepare' || (this.state === 'attack' && kind !== 'sweep'));
      if (group.visible)
        (
          group.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
        ).material.opacity =
          kind === 'lunge' ? 0.13 + windup * 0.14 : 0.4 + windup * 0.4 + Math.sin(time * 12) * 0.05;
    }
    if (moving) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.26;
        this.effects.splash(
          this.position.x + (Math.sin(time * 6) > 0 ? 1 : -1) * 3,
          this.position.z + Math.sin(time * 4) * 2,
          1.3,
        );
      }
    }
    dx = player.position.x - this.position.x;
    dz = player.position.z - this.position.z;
    const separation = Math.hypot(dx, dz);
    if (
      separation < 2.25 &&
      separation > 0.01 &&
      this.active &&
      !(this.state === 'attack' && this.attackKind === 'lunge')
    )
      this.collision.move(
        player.position,
        (dx / separation) * (2.25 - separation),
        (dz / separation) * (2.25 - separation),
        PLAYER.radius,
      );
  }
  private prepare(kind: AttackKind, angle: number) {
    this.attackKind = kind;
    this.targetAngle = angle;
    this.state = 'prepare';
    this.timer = BOSS_ATTACKS[kind].windup;
    this.marksDone = 0;
    this.audio.play('telegraph');
    if (kind === 'eruption') {
      const count = this.phase === 2 ? 10 : 8;
      for (let i = 0; i < count; i++) {
        const a = (i * Math.PI * 2) / count + angle;
        const x = this.position.x + Math.sin(a) * 6,
          z = this.position.z + Math.cos(a) * 6;
        // Keep warnings in the playable chamber; gaps remain traversable.
        if (Math.abs(x) < 11.4 && z > -150 && z < -118)
          this.hazards.spawn(
            'spire',
            x,
            z,
            BOSS_ATTACKS.eruption.windup + 0.22,
            1.25,
            BOSS_ATTACKS.eruption.damage,
          );
      }
    }
  }
  private damage(player: Player) {
    const data = BOSS_ATTACKS[this.attackKind];
    const result = player.takeDamage(data.damage, this.position.x, this.position.z, data.heavy);
    if (result !== 'miss') this.onDamage(result === 'blocked');
  }
  private setWave(radius: number) {
    const attribute = this.wave.geometry.getAttribute('position');
    for (let row = 0; row < 2; row++) {
      const r = radius + ((row ? 1 : -1) * SOUL_RING.width) / 2;
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        attribute.setXYZ(row * 97 + i, Math.cos(a) * r, Math.sin(a) * r, 0);
      }
    }
    attribute.needsUpdate = true;
    this.wave.geometry.computeBoundingSphere();
    this.wave.position.set(this.position.x, 0.11, this.position.z);
    this.wave.visible = true;
  }
  private clearWarnings() {
    this.hazards.reset();
    this.wave.visible = false;
    for (const group of this.indicators.values()) group.visible = false;
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
      this.state === 'phase' ||
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
      this.clearWarnings();
      this.audio.setBoss(false);
      this.audio.play('death');
      this.onDeath();
    }
    return true;
  }
  reset() {
    this.state = 'idle';
    this.phase = 1;
    this.health = BOSS.health;
    this.timer = 0;
    this.deadTime = 0;
    this.lastHit = -1;
    this.attackIndex = 0;
    this.attackKind = 'slash';
    this.targetAngle = 0;
    this.beatsDone = this.marksDone = 0;
    this.damageDone = false;
    this.position.set(0, 0, BOSS.spawnZ);
    this.model.group.rotation.set(0, 0, 0);
    this.model.reset();
    this.clearWarnings();
    this.audio.setBoss(false);
  }
}
