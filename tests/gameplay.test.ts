import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CollisionSystem } from '../src/game/CollisionSystem';
import { inAttackArc } from '../src/game/math';
import { PLAYER, BOSS_AGGRO_DISTANCE, BOSS } from '../src/game/config';
import { Player } from '../src/player/Player';
import { Enemy } from '../src/enemies/Enemy';
import { Boss } from '../src/enemies/Boss';
import { BOSS_ATTACKS, canBossAggro } from '../src/enemies/BossAI';
import type { Effects } from '../src/world/Effects';
import type { AudioManager } from '../src/audio/AudioManager';
import type { InputManager } from '../src/game/InputManager';

const effects = { burst() {}, splash() {}, ripple() {} } as unknown as Effects;
const audio = { play() {}, setBoss() {} } as unknown as AudioManager;
function setup() {
  const collision = new CollisionSystem();
  const player = new Player(collision, effects, audio);
  player.position.set(0, 0, 0);
  return { collision, player };
}
function input(keys: string[] = [], attack = false, block = false, pressed: string[] = []) {
  const held = new Set(keys),
    edge = new Set(pressed);
  return {
    attack,
    block,
    down: (...codes: string[]) => codes.some((c) => held.has(c)),
    consume: (code: string) => {
      const has = edge.has(code);
      edge.delete(code);
      return has;
    },
  } as InputManager;
}

test('collision prevents high-speed tunnelling and lets the robot slide along walls', () => {
  const c = new CollisionSystem();
  c.add(0, 0, 1, 10);
  const p = { x: -2, z: 0 };
  c.move(p, 9, 3, 0.47);
  assert.ok(p.x < -0.95);
  assert.ok(p.z > 2.9);
  const edge = { x: 12, z: -80 };
  c.move(edge, 30, -200, 0.47);
  assert.ok(edge.x <= 12.53);
  assert.ok(edge.z >= -152.53);
});
test('opening a seal removes its physical barrier', () => {
  const c = new CollisionSystem(),
    gate = c.add(0, -20, 8, 1);
  assert.equal(c.blocked(0, -20, 0.47), true);
  gate.active = false;
  assert.equal(c.blocked(0, -20, 0.47), false);
});
test('sword arc respects both range and facing across the angle wrap', () => {
  assert.ok(inAttackArc(0, 0, Math.PI, 0, -2, 2.6));
  assert.ok(inAttackArc(0, 0, -Math.PI + 0.02, 0.01, -2, 2.6));
  assert.equal(inAttackArc(0, 0, 0, 0, -2, 2.6), false);
  assert.equal(inAttackArc(0, 0, 0, 0, 3, 2.6), false);
});
test('movement responds on the first frame and normalized diagonals are no faster', () => {
  const a = setup().player,
    b = setup().player;
  for (let i = 0; i < 30; i++) {
    a.update(1 / 60, i / 60, input(['KeyW']), null);
    b.update(1 / 60, i / 60, input(['KeyW', 'KeyD']), null);
  }
  assert.ok(Math.abs(Math.hypot(a.position.x, a.position.z) - PLAYER.speed * 0.5) < 0.01);
  assert.ok(Math.abs(a.position.length() - b.position.length()) < 0.01);
});
test('sprint is faster and consumes stamina; idle replenishes it', () => {
  const { player } = setup();
  for (let i = 0; i < 60; i++) player.update(1 / 60, i / 60, input(['KeyW', 'ShiftLeft']), null);
  assert.ok(player.position.length() > 8.5);
  assert.ok(player.stamina < 80);
  for (let i = 0; i < 60; i++) player.update(1 / 60, i / 60, input(), null);
  assert.equal(player.stamina, 100);
});
test('frontal blocking negates weak attacks, drains stamina and allows heavy chip damage', () => {
  const { player } = setup();
  player.facing = 0;
  player.blocking = true;
  assert.equal(player.takeDamage(20, 0, 2), 'blocked');
  assert.equal(player.health, 100);
  assert.equal(player.stamina, 88);
  player.invulnerable = 0;
  assert.equal(player.takeDamage(34, 0, 2, true), 'blocked');
  assert.equal(player.health, 95);
  assert.equal(player.stamina, 64);
  player.invulnerable = 0;
  assert.equal(player.takeDamage(20, 0, -2), 'hurt');
  assert.equal(player.health, 75);
});
test('evasion has a bounded invulnerability window and a stamina cost', () => {
  const { player } = setup();
  player.update(1 / 60, 0, input([], false, false, ['Space']), null);
  assert.equal(player.takeDamage(30, 0, 1), 'miss');
  assert.ok(player.stamina < 80);
  for (let i = 0; i < 30; i++) player.update(1 / 60, i / 60, input(), null);
  assert.equal(player.takeDamage(30, 0, 1), 'hurt');
  assert.equal(player.health, 70);
});
test('one swing has one impact window and cannot damage an enemy twice', () => {
  const { player, collision } = setup();
  const enemy = new Enemy('armor', 1, 0, 1.7, collision, effects, audio);
  let windows = 0;
  for (let i = 0; i < 30; i++) {
    player.update(1 / 60, i / 60, input([], i === 0), new THREE.Vector3(0, 0, 3));
    if (player.hitWindow) {
      windows++;
      assert.equal(enemy.tryHit(player), true);
      assert.equal(enemy.tryHit(player), false);
    }
  }
  assert.equal(windows, 1);
  assert.equal(enemy.health, 64);
});
test('the boss stays dormant at the aggro boundary and wakes once inside it', () => {
  assert.equal(canBossAggro(BOSS_AGGRO_DISTANCE, 100, BOSS_AGGRO_DISTANCE), false);
  assert.equal(canBossAggro(1, 0, BOSS_AGGRO_DISTANCE), false);
  const { player, collision } = setup(),
    boss = new Boss(collision, effects, audio);
  let aggro = 0;
  boss.onAggro = () => aggro++;
  player.position.set(0, 0, BOSS.spawnZ + BOSS_AGGRO_DISTANCE + 1);
  boss.update(0.1, 0, player);
  assert.equal(boss.state, 'idle');
  player.position.z = BOSS.spawnZ + BOSS_AGGRO_DISTANCE - 0.1;
  boss.update(0.1, 0.1, player);
  assert.equal(boss.state, 'wake');
  assert.equal(aggro, 1);
  assert.equal(boss.health, BOSS.health);
  boss.update(0.1, 0.2, player);
  assert.equal(aggro, 1);
});
test('boss independently reaches all four telegraphs and recovery states', () => {
  const { player, collision } = setup(),
    boss = new Boss(collision, effects, audio);
  const observed = new Set<string>();
  const tells = new Set<string>();
  for (let frame = 0; frame < 60 * 80; frame++) {
    // Keep a living target in striking distance without changing the boss FSM.
    player.position.set(boss.position.x, 0, boss.position.z + 4.7);
    player.health = 100;
    player.invulnerable = 10;
    boss.update(1 / 60, frame / 60, player);
    observed.add(boss.state);
    if (boss.state === 'prepare') tells.add(boss.attackKind);
  }
  assert.deepEqual([...tells].sort(), Object.keys(BOSS_ATTACKS).sort());
  for (const state of ['wake', 'chase', 'prepare', 'attack', 'recover', 'reposition'])
    assert.ok(observed.has(state), state);
  assert.ok(boss.position.distanceTo(new THREE.Vector3(0, 0, BOSS.spawnZ)) > 1);
});
test('boss death fires once and reset fully restores the encounter', () => {
  const { player, collision } = setup(),
    boss = new Boss(collision, effects, audio);
  let deaths = 0;
  boss.onDeath = () => deaths++;
  boss.state = 'recover';
  player.position.set(0, 0, BOSS.spawnZ + 3);
  player.facing = Math.PI;
  player.hitWindow = true;
  for (let i = 0; i < 40; i++) {
    player.attackId = i;
    boss.tryHit(player);
  }
  assert.equal(boss.health, 0);
  assert.equal(boss.state, 'dead');
  assert.equal(deaths, 1);
  boss.reset();
  assert.equal(boss.health, BOSS.health);
  assert.equal(boss.state, 'idle');
  assert.equal(boss.position.z, BOSS.spawnZ);
  assert.equal(boss.deadTime, 0);
});
test('player reset clears death, block and attack states for a checkpoint retry', () => {
  const { player } = setup();
  player.health = 0;
  player.deadTime = 2;
  player.blocking = true;
  player.attackTimer = 0.4;
  player.dodgeTimer = 0.2;
  player.reset(-111);
  assert.equal(player.health, 100);
  assert.equal(player.stamina, 100);
  assert.equal(player.position.z, -111);
  assert.equal(player.blocking, false);
  assert.equal(player.attackTimer, 0);
  assert.equal(player.dodgeTimer, 0);
  assert.equal(player.deadTime, 0);
});
