import { loadMachineAssets } from './fixtures/machine-assets';
const machine = await loadMachineAssets();
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { loadCreatureAssets } from './fixtures/creature-assets';
import { Boss } from '../src/enemies/Boss';
import { BossHazards } from '../src/enemies/BossHazards';
import { ArmorModel, SpiderModel, ReaperModel } from '../src/enemies/CreatureModels';
import {
  BOSS_ATTACKS,
  chooseBossAttack,
  attackDuration,
  type AttackKind,
} from '../src/enemies/BossAI';
import { CollisionSystem } from '../src/game/CollisionSystem';
import { Player } from '../src/player/Player';
import { BOSS } from '../src/game/config';
import type { Effects } from '../src/world/Effects';
import type { AudioManager } from '../src/audio/AudioManager';

const assets = await loadCreatureAssets();
const effects = { burst() {}, splash() {}, ripple() {} } as unknown as Effects;
const audio = { play() {}, setBoss() {} } as unknown as AudioManager;
function encounter(kind: AttackKind = 'slash', phase = 1) {
  const collision = new CollisionSystem(),
    player = new Player(collision, effects, audio, machine);
  const boss = new Boss(collision, effects, audio, assets);
  boss.phase = phase;
  boss.state = 'chase';
  boss.attackIndex = Array.from({ length: 9 }, (_, i) => chooseBossAttack(i, 4.7, phase)).indexOf(
    kind,
  );
  player.position.set(0, 0, BOSS.spawnZ + 4.7);
  boss.update(0.001, 0, player);
  assert.equal(boss.state, 'prepare');
  assert.equal(boss.attackKind, kind);
  let time = 0;
  function tick(duration: number, holdTarget = false) {
    const count = Math.ceil(duration * 120);
    for (let i = 0; i < count; i++) {
      const dt = duration / count;
      player.invulnerable = Math.max(0, player.invulnerable - dt);
      if (holdTarget) player.position.set(boss.position.x, 0, boss.position.z + 4.7);
      time += dt;
      boss.update(dt, time, player);
    }
  }
  return { boss, player, collision, tick };
}

test('Blender monsters export bounded complete geometry and a genuinely recessed hood', () => {
  for (const name of ['armor', 'spider', 'reaper', 'grave_spire'] as const) {
    const root = assets.clone(name);
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root);
    assert.ok(bounds.min.y > -0.05 && bounds.min.y < 0.06, `${name} feet stay at ground level`);
    assert.ok(bounds.max.y < 7.4, 'export hierarchy must not add a pivot twice');
    let triangles = 0;
    root.traverse((part) => {
      if (!(part instanceof THREE.Mesh)) return;
      const positions = part.geometry.getAttribute('position');
      for (const value of positions.array) assert.ok(Number.isFinite(value));
      for (const attribute of ['normal', 'uv', 'color'])
        assert.ok(part.geometry.getAttribute(attribute), `${name} ${attribute}`);
      triangles += (part.geometry.index?.count ?? positions.count) / 3;
    });
    assert.ok(triangles > 100 && triangles < 10000);
  }
  const reaper = assets.clone('reaper');
  reaper.updateMatrixWorld(true);
  const hood = reaper.getObjectByName('reaper_hood')!;
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 6.1, 4), new THREE.Vector3(0, 0, -1));
  const hits = ray.intersectObject(hood);
  assert.ok(hits.length);
  assert.ok(hits[0].point.z < 0.1, 'open cowl reveals a deep lining, not a flat faceplate');
  ray.set(new THREE.Vector3(0.91, 5.65, 4), new THREE.Vector3(0, 0, -1));
  assert.ok(
    ray.intersectObject(hood)[0].point.z > 0.8,
    'thick cloth rim stands ahead of the lining',
  );
});

test('all Blender actors preserve world elevation and reset their authored pivots', () => {
  const models = [
    new ArmorModel(assets.clone('armor')),
    new SpiderModel(assets.clone('spider')),
    new ReaperModel(assets.clone('reaper')),
  ];
  for (const model of models) {
    model.group.position.set(3, 1.8, -40);
    const rest = new Map<THREE.Object3D, THREE.Matrix4>();
    model.group.traverse((part) => {
      part.updateMatrix();
      rest.set(part, part.matrix.clone());
    });
    model.animate(3, true, 0.7, 0.3, 1.1);
    assert.equal(model.group.position.y, 1.8);
    model.reset();
    model.group.traverse((part) => {
      part.updateMatrix();
      assert.ok(
        part.matrix.elements.every(
          (value, i) => Math.abs(value - rest.get(part)!.elements[i]) < 1e-8,
        ),
      );
    });
  }
});

test('committed scythe aim locks, warns without damage, and recovery leaves a punish window', () => {
  const { boss, player, tick } = encounter('heavy');
  tick(0.75);
  assert.equal(player.health, 100);
  const aim = boss.model.group.rotation.y;
  player.position.set(4.7, 0, BOSS.spawnZ);
  tick(0.5);
  assert.equal(boss.model.group.rotation.y, aim);
  assert.equal(player.health, 100);
  tick(0.9);
  assert.equal(player.health, 100, 'moving outside the locked wedge evades execution');
  assert.equal(boss.state, 'recover');
  assert.ok(boss.timer > 1.3, 'the heavy attack is punishable');
});

test('reaping combo delivers two discrete hits, then adds a third in phase two', () => {
  for (const phase of [1, 2]) {
    const { boss, player, tick } = encounter('slash', phase);
    tick(BOSS_ATTACKS.slash.windup + 0.02, true);
    assert.equal(player.health, 100);
    let hits = 0;
    boss.onDamage = () => hits++;
    tick(attackDuration('slash', phase) + 0.02, true);
    assert.equal(hits, phase === 1 ? 2 : 3);
    assert.equal(player.health, 100 - (phase === 1 ? 48 : 72));
    assert.equal(boss.state, 'recover');
  }
});

test('grave rush uses swept movement collision and a sidestep clears its lane', () => {
  for (const sidestep of [false, true]) {
    const { boss, player, tick } = encounter('lunge');
    tick(BOSS_ATTACKS.lunge.windup + 0.02);
    player.position.set(sidestep ? 2.2 : 0, 0, BOSS.spawnZ + 7.5);
    let hits = 0;
    boss.onDamage = () => hits++;
    tick(BOSS_ATTACKS.lunge.duration + 0.02);
    assert.ok(boss.position.z > BOSS.spawnZ + 8, 'rush traverses its shown lane');
    assert.equal(hits, sidestep ? 0 : 1);
    assert.equal(player.health, sidestep ? 100 : 73);
  }
});

test('soul ring damages only the passing band and an evade can cross it safely', () => {
  for (const dodge of [false, true]) {
    const { boss, player, tick } = encounter('sweep');
    tick(BOSS_ATTACKS.sweep.windup + 0.02);
    player.position.set(0, 0, BOSS.spawnZ + 7);
    tick(0.5);
    assert.equal(player.health, 100, 'outer field stays safe before the ring arrives');
    if (dodge) player.invulnerable = 0.3;
    tick(0.26);
    assert.equal(player.health, dodge ? 100 : 71);
    player.invulnerable = 0;
    player.position.set(0, 0, BOSS.spawnZ + 3);
    tick(0.6);
    assert.equal(player.health, dodge ? 100 : 71, 'the emptied interior is safe');
    assert.equal(boss.state, 'recover');
  }
});

test('ground marks freeze their target, wait for the warning, strike once and clear on retry', () => {
  const player = new Player(new CollisionSystem(), effects, audio, machine);
  const hazards = new BossHazards(assets.clone('grave_spire'), effects, audio);
  player.position.set(0, 0, -130);
  hazards.spawn('shadow', 0, -130, 0.92, 1.5, 23);
  hazards.update(0.85, player);
  assert.equal(player.health, 100);
  player.position.x = 3;
  hazards.update(0.08, player);
  assert.equal(player.health, 100, 'marked ground stops following the player');
  hazards.reset();
  hazards.spawn('spire', 3, -130, 1.2, 1.25, 30);
  hazards.update(1.19, player);
  assert.equal(player.health, 100);
  hazards.update(0.02, player);
  assert.equal(player.health, 70);
  player.invulnerable = 0;
  hazards.update(0.1, player);
  assert.equal(player.health, 70, 'a visible retracting spike does not reapply damage');
  hazards.reset();
  assert.equal(hazards.activeCount, 0);
  hazards.update(4, player);
  assert.equal(player.health, 70);
});

test('phase transition fires once, clears hazards, and death cancels every pending strike', () => {
  const { boss, player, tick } = encounter('hunt');
  tick(0.5);
  assert.ok(boss.hazards.activeCount > 0);
  boss.health = BOSS.health / 2;
  let phases = 0;
  boss.onPhase = () => phases++;
  player.invulnerable = 20;
  tick(0.2);
  assert.equal(phases, 0, 'committed attacks finish before changing phase');
  tick(1.5);
  assert.equal(boss.state, 'phase');
  assert.equal(phases, 1);
  assert.equal(boss.hazards.activeCount, 0);
  tick(2.3);
  assert.equal(boss.phase, 2);
  assert.equal(phases, 1);
  boss.state = 'recover';
  boss.health = 32;
  boss.hazards.spawn('shadow', player.position.x, player.position.z, 0.92, 1.5, 23);
  player.position.copy(boss.position).add(new THREE.Vector3(0, 0, 3));
  player.facing = Math.PI;
  player.hitWindow = true;
  player.attackId++;
  assert.equal(boss.tryHit(player), true);
  assert.equal(boss.state, 'dead');
  assert.equal(boss.hazards.activeCount, 0);
  player.invulnerable = 0;
  tick(2);
  assert.equal(player.health, 100);
  boss.reset();
  assert.equal(boss.phase, 1);
  assert.equal(boss.state, 'idle');
  assert.equal(boss.hazards.activeCount, 0);
});

test('Blender clips retain the transformed silhouette through every attack and reset on retry', () => {
  const root = assets.clone('reaper'),
    model = new ReaperModel(root);
  assert.equal(root.animations.length, 24);
  const mantle = root.getObjectByName('reaper_mantle_left')!;
  const jaw = root.getObjectByName('reaper_jaw')!;
  model.animateState('idle', 'slash', 1, 0, 0);
  const closed = mantle.quaternion.clone();
  model.animateState('phase', 'slash', 2, 0.01, 0);
  const open = mantle.quaternion.clone();
  assert.ok(open.angleTo(closed) > 0.9);
  for (const kind of Object.keys(BOSS_ATTACKS) as AttackKind[]) {
    const clip = root.animations.find((c) => c.name === `reaper_${kind}_2`)!;
    assert.ok(clip);
    assert.ok(
      Math.abs(
        clip.duration -
          (BOSS_ATTACKS[kind].windup + attackDuration(kind, 2) + BOSS_ATTACKS[kind].recovery * 0.8),
      ) < 0.015,
      kind,
    );
    model.animateState('prepare', kind, 2, BOSS_ATTACKS[kind].windup * 0.5, 0);
    assert.ok(mantle.quaternion.angleTo(open) < 0.02, `${kind} folds the phase-two mantle`);
    assert.ok(jaw.rotation.x > 0.6, `${kind} closes the transformed jaw`);
  }
  model.reset();
  assert.ok(mantle.quaternion.angleTo(closed) < 1e-6);
});

test('gallows fall locks a visible landing, stays harmless in flight, and hits exactly at touchdown', () => {
  for (const sidestep of [false, true]) {
    const { boss, player, tick } = encounter('dive');
    const target = player.position.clone();
    tick(BOSS_ATTACKS.dive.windup + 0.02);
    assert.equal(player.health, 100);
    const body = boss.model.group.getObjectByName('reaper_body')!;
    tick(0.45);
    assert.ok(body.position.y > 6, 'the Blender leap visibly leaves the floor');
    if (sidestep) player.position.x = target.x + 5.4;
    tick(0.48);
    assert.equal(player.health, 100, 'airborne limbs cannot hit grounded players');
    tick(0.13);
    assert.ok(
      boss.position.distanceTo(target) < 0.05,
      'the landing does not track a late sidestep',
    );
    assert.equal(player.health, sidestep ? 100 : 66);
    assert.ok(body.position.y < 0, 'contact compresses into the ground');
  }
});

test('phase-two landing sends a ring across the outer floor while leaving its centre safe', () => {
  const { boss, player, tick } = encounter('dive', 2);
  tick(BOSS_ATTACKS.dive.windup + 0.02);
  const z = player.position.z;
  player.position.set(6.7, 0, z);
  tick(1.07);
  assert.equal(player.health, 100);
  tick(0.7);
  assert.equal(player.health, 66, 'outer band reaches the waiting player after landing');
  player.invulnerable = 0;
  player.position.copy(boss.position);
  tick(0.25);
  assert.equal(player.health, 66, 'the emptied interior cannot hit again');
});

test('widow return follows a distinct return path, respects dodge, and clears on death', () => {
  const { boss, player, tick } = encounter('reave');
  const path = boss.blades.paths[0];
  assert.equal(path.points.length, 81);
  assert.ok(path.points[20].x > 1.5 && path.points[60].x < -3.5);
  assert.ok(path.points[0].distanceTo(path.points[80]) < 1e-6);
  player.position.copy(path.points[60]);
  tick(BOSS_ATTACKS.reave.windup + 0.02);
  assert.equal(player.health, 100);
  tick(1.3);
  assert.equal(player.health, 100, 'the outbound blade is on the other side');
  tick(1.15);
  assert.equal(player.health, 74, 'return crescent crosses its painted return lane');
  boss.state = 'dead';
  tick(0.1);
  assert.equal(boss.blades.activeCount, 0);
});

test('crossing blades are phase-two-only, stagger their releases, and leave gaps between lanes', () => {
  for (let i = 0; i < 32; i++) assert.notEqual(chooseBossAttack(i, 4, 1), 'loom');
  const { boss, player, tick } = encounter('loom', 2);
  assert.deepEqual(
    boss.blades.paths.map((p) => p.start),
    [0.15, 0.65, 1.2, 1.7],
  );
  const centre = player.position.clone();
  player.position.set(centre.x + 5, 0, centre.z);
  tick(BOSS_ATTACKS.loom.windup + BOSS_ATTACKS.loom.duration + 0.03);
  assert.equal(
    player.health,
    100,
    'moving sideways out of the diagonal cross leaves a safe pocket',
  );
  assert.equal(boss.blades.activeCount, 0);
  assert.equal(boss.state, 'recover');
});

test('the aerial leap clears intervening masonry and still lands on its committed marker', () => {
  const { boss, player, collision, tick } = encounter('dive');
  const target = player.position.clone();
  collision.add(0, BOSS.spawnZ + 2.3, 2, 0.7);
  tick(BOSS_ATTACKS.dive.windup + 1.07);
  assert.ok(boss.position.distanceTo(target) < 0.05);
  assert.equal(player.health, 66);
});

test('a swept blade cannot tunnel through a target on a slow frame; evasion prevents damage', () => {
  for (const dodge of [false, true]) {
    const { boss, player } = encounter('loom', 2);
    const path = boss.blades.paths[0];
    player.position.copy(path.points[16]);
    if (dodge) player.invulnerable = 1;
    boss.blades.update(0.1, 1.1, player, 25);
    assert.equal(player.health, dodge ? 100 : 75);
    player.invulnerable = 0;
    boss.blades.reset();
    boss.blades.update(0, 10, player, 25);
    assert.equal(player.health, dodge ? 100 : 75);
  }
});
