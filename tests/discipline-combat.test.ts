import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadMachineAssets } from './fixtures/machine-assets';
import { loadCreatureAssets } from './fixtures/creature-assets';
import { Player } from '../src/player/Player';
import { Enemy, ENEMY_PROFILES } from '../src/enemies/Enemy';
import { STRIKE_CONTACT } from '../src/enemies/AttackMotion';
import { ReaperModel } from '../src/enemies/CreatureModels';
import { REAPING_BEATS } from '../src/enemies/BossAI';
import { DisciplineAbilities, DISCIPLINES } from '../src/combat/Disciplines';
import { parseJourney } from '../src/progression/JourneySave';
import { CollisionSystem } from '../src/game/CollisionSystem';
import { FIELD_BOUNDS, isFieldSanctuary } from '../src/world/GreenfieldsConfig';
import type { Effects } from '../src/world/Effects';
import type { AudioManager } from '../src/audio/AudioManager';
import type { InputManager } from '../src/game/InputManager';
const machine = await loadMachineAssets(),
  castle = await loadCreatureAssets();
const bytes = await readFile(new URL('../public/models/greenfields-kit.glb', import.meta.url));
const fields = (
  await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  )
).scene;
const effects = { burst() {}, splash() {}, ripple() {} } as unknown as Effects;
const audio = { play() {} } as unknown as AudioManager;
const camera = new THREE.PerspectiveCamera();
const idle = (block = false) =>
  ({ down: () => false, consume: () => false, block, attack: false }) as unknown as InputManager;
function setup(type: Enemy['type'] = 'wolf', x = 0, z = 0) {
  const collision = new CollisionSystem(FIELD_BOUNDS);
  const player = new Player(collision, effects, audio, machine);
  player.position.set(0, 0, 0);
  const template =
    type === 'armor' || type === 'spider'
      ? castle.clone(type)
      : (fields.getObjectByName(type)!.clone(true) as THREE.Group);
  const enemy = new Enemy(
    type,
    type === 'armor' || type === 'spider' ? 1 : 5,
    x,
    z,
    collision,
    effects,
    audio,
    template,
  );
  return { collision, player, enemy };
}
test('all five ordinary creatures deal one hit at visible contact, never during the windup', () => {
  for (const type of Object.keys(ENEMY_PROFILES) as Enemy['type'][]) {
    for (const dt of [1 / 120, 0.05]) {
      const { player, enemy } = setup(type);
      player.position.z = ENEMY_PROFILES[type].range * 0.9;
      enemy.state = 'prepare';
      enemy.timer = ENEMY_PROFILES[type].windup;
      while (enemy.state === 'prepare') {
        enemy.update(dt, 0, player, camera);
        assert.equal(player.health, 100, `${type} hits during preparation`);
      }
      const attackStart = enemy.timer;
      let hits = 0,
        elapsed = 0;
      const take = player.takeDamage.bind(player);
      player.takeDamage = (...args) => {
        hits++;
        return take(...args);
      };
      while (enemy.state === 'attack') {
        elapsed += dt;
        enemy.update(dt, elapsed, player, camera);
        if (elapsed < attackStart * STRIKE_CONTACT - 1e-8) assert.equal(player.health, 100);
      }
      assert.equal(hits, 1, `${type}: hit accounting`);
      assert.equal(player.health, 100 - ENEMY_PROFILES[type].damage);
      assert.equal(enemy.state, 'recover');
    }
  }
});
test('a committed ordinary strike misses a player who steps behind or evades', () => {
  for (const evading of [false, true]) {
    const { enemy, player } = setup('armor');
    player.position.z = 1.7;
    enemy.state = 'prepare';
    enemy.timer = 0.75;
    while (enemy.state === 'prepare') enemy.update(0.01, 0, player, camera);
    if (evading) player.invulnerable = 0.4;
    else player.position.z = -1.7;
    while (enemy.state === 'attack') enemy.update(0.01, 0, player, camera);
    assert.equal(player.health, 100);
  }
});
test('monster pose changes through contact and restores authored pivots without moving the actor', () => {
  for (const type of Object.keys(ENEMY_PROFILES) as Enemy['type'][]) {
    const { enemy } = setup(type);
    enemy.position.y = 2.7;
    const name =
      type === 'armor' ? 'armor_arm_right' : type === 'spider' ? 'spider_body' : `${type}_body`;
    const part = enemy.model.group.getObjectByName(name)!;
    enemy.model.animate(0, false, 1, 0);
    const windup = part.rotation.clone();
    enemy.model.animate(0, false, 0, STRIKE_CONTACT);
    assert.notDeepEqual(part.rotation.toArray(), windup.toArray(), type);
    assert.equal(enemy.position.y, 2.7);
    enemy.model.animate(0, false, 0, 0);
    const rest = part.position.clone();
    for (let i = 0; i < 10; i++) enemy.model.animate(0, false, 0, 0);
    assert.ok(part.position.distanceTo(rest) < 1e-8, `${type}: cumulative displacement`);
  }
  const reaper = new ReaperModel(castle.clone('reaper'));
  const scythe = reaper.group.getObjectByName('reaper_scythe')!;
  for (const beat of REAPING_BEATS) {
    reaper.animate(0, false, 0, beat, 0, 'slash', 2);
    const impact = scythe.rotation.x;
    reaper.animate(0, false, 0, beat + 0.12, 0, 'slash', 2);
    assert.ok(impact > scythe.rotation.x, `scythe misses beat ${beat}`);
  }
});
test('Blender robot and drone have complete geometry, ground contact and all equipment pivots', () => {
  for (const name of ['robot', 'wisp_drone'] as const) {
    const root = machine.clone(name);
    let triangles = 0;
    root.traverse((part) => {
      if (!(part instanceof THREE.Mesh)) return;
      for (const name of ['position', 'normal', 'color', 'uv']) {
        const attr = part.geometry.getAttribute(name);
        assert.ok(attr, name);
        for (const n of attr.array) assert.ok(Number.isFinite(n));
      }
      triangles += (part.geometry.index?.count ?? part.geometry.attributes.position.count) / 3;
    });
    assert.ok(triangles > 100 && triangles < 15000);
    if (name === 'robot') {
      const bounds = new THREE.Box3().setFromObject(root);
      assert.ok(bounds.min.y >= -0.005 && bounds.min.y < 0.04);
      for (const pivot of [
        'pose',
        'body',
        'head',
        'leg_left',
        'leg_right',
        'arm_left',
        'arm_right',
        'sword',
      ])
        assert.ok(root.getObjectByName(`robot_${pivot}`));
    }
  }
});
test('Stormblade costs energy once, chains at most three targets, and stops at physical walls', () => {
  const { collision, player, enemy } = setup('wolf', 0, 3);
  const enemies = [
    enemy,
    setup('wolf', 2, 3).enemy,
    setup('wolf', 4, 3).enemy,
    setup('wolf', 6, 3).enemy,
  ];
  const ability = new DisciplineAbilities(machine);
  player.chooseDiscipline('stormblade');
  ability.activate(player, enemies, collision, effects, audio);
  assert.equal(enemies.filter((e) => e.health === 54).length, 3);
  assert.equal(player.stamina, 62);
  assert.equal(player.abilityCooldown, 7);
  ability.activate(player, enemies, collision, effects, audio);
  assert.equal(player.stamina, 62);
  player.abilityCooldown = 0;
  player.stamina = 100;
  collision.add(0, 1.5, 30, 0.5);
  const health = enemy.health;
  ability.activate(player, enemies, collision, effects, audio);
  assert.equal(enemy.health, health);
  assert.equal(player.stamina, 100);
});
test('Bulwark charges only a fresh timed frontal guard and consumes its one charge', () => {
  const { collision, player, enemy } = setup('golem', 0, 3);
  player.chooseDiscipline('bulwark');
  player.facing = 0;
  player.update(0.01, 0, idle(true), null);
  assert.equal(player.takeDamage(10, 0, 3), 'blocked');
  assert.equal(player.parryCharge, true);
  player.update(0.3, 0.3, idle(), null);
  const ability = new DisciplineAbilities(machine);
  ability.activate(player, [enemy], collision, effects, audio);
  assert.equal(player.parryCharge, false);
  assert.equal(enemy.health, 200);
  assert.equal(enemy.timer, 1.4);
  player.abilityCooldown = 0;
  player.update(0.01, 1, idle(true), null);
  player.update(0.23, 1.23, idle(true), null);
  player.invulnerable = 0;
  player.takeDamage(10, 0, 3);
  assert.equal(player.parryCharge, false, 'held guard cannot generate charge');
  player.update(0.3, 2, idle(), null);
  player.update(0.01, 2.01, idle(true), null);
  player.invulnerable = 0;
  player.takeDamage(10, 0, -3);
  assert.equal(player.parryCharge, false, 'rear hits cannot generate charge');
});
test('Wispkeeper interrupts one enemy, expires, ends on damage, and cancels on sanctuary or death', () => {
  for (const end of ['time', 'hit', 'sanctuary', 'death', 'retry']) {
    const { collision, player, enemy } = setup('wolf', 0, 3);
    const ability = new DisciplineAbilities(machine);
    player.chooseDiscipline('wispkeeper');
    enemy.state = 'prepare';
    enemy.timer = 0.001;
    ability.activate(player, [enemy], collision, effects, audio);
    assert.equal(enemy.distracted, 2.6);
    assert.equal(player.stamina, 70);
    assert.equal(player.abilityCooldown, 10);
    enemy.update(0.1, 0, player, camera);
    assert.equal(player.health, 100);
    if (end === 'hit') enemy.receiveDamage(1, player);
    if (end === 'sanctuary') player.position.set(16, 0, -16);
    if (end === 'death') player.health = 0;
    if (end === 'retry') ability.reset();
    ability.update(end === 'time' ? 2.7 : 0.1, 1, player);
    assert.equal(enemy.distracted, 0);
    assert.equal(ability.group.getObjectByName('wisp_drone')!.visible, false);
  }
});
test('no ability fires in sanctuary or grants energy/cooldown by switching; death clears charge', () => {
  const { collision, player, enemy } = setup('wolf', 16, -14);
  const ability = new DisciplineAbilities(machine);
  for (const discipline of Object.keys(DISCIPLINES) as (keyof typeof DISCIPLINES)[]) {
    player.chooseDiscipline(discipline);
    player.position.set(16, 0, -16);
    assert.ok(isFieldSanctuary(player.position.x, player.position.z));
    ability.activate(player, [enemy], collision, effects, audio);
    assert.equal(player.stamina, 100);
    assert.equal(enemy.health, enemy.maxHealth);
  }
  player.abilityCooldown = 5;
  player.stamina = 17;
  player.parryCharge = true;
  player.chooseDiscipline('stormblade');
  assert.equal(player.abilityCooldown, 5);
  assert.equal(player.stamina, 17);
  assert.equal(player.parryCharge, false);
  player.reset();
  assert.equal(player.discipline, 'stormblade');
  assert.equal(player.abilityCooldown, 0);
});
test('old saves migrate without unlocking disciplines and restored choices survive validation', () => {
  const save = {
    version: 1,
    chapter: 'fields',
    firstlight: { accepted: true, recovered: ['winding', 'sunwheel'], restored: true },
  };
  assert.equal(parseJourney(JSON.stringify(save))?.discipline, null);
  for (const discipline of Object.keys(DISCIPLINES))
    assert.equal(parseJourney(JSON.stringify({ ...save, discipline }))?.discipline, discipline);
  assert.equal(
    parseJourney(JSON.stringify({ ...save, discipline: '__proto__' }))?.discipline,
    null,
  );
  assert.equal(
    parseJourney(JSON.stringify({ ...save, firstlight: {}, discipline: 'stormblade' }))?.discipline,
    null,
  );
});
