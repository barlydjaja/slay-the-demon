import {
  FirstlightQuest,
  FIRSTLIGHT_PARTS,
  MARA_POSITION,
} from '../src/progression/FirstlightQuest';
import { JourneySave } from '../src/progression/JourneySave';
import { FirstlightAssets } from '../src/world/FirstlightAssets';
import { loadFirstlightAssets } from './fixtures/firstlight-assets';
import { loadCastleAssets } from './fixtures/castle-assets';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FieldAssets } from '../src/world/FieldAssets';
import { Greenfields } from '../src/world/Greenfields';
import { Castle } from '../src/world/Castle';
import { CollisionSystem } from '../src/game/CollisionSystem';
import { Enemy, ENEMY_PROFILES } from '../src/enemies/Enemy';
import { Effects } from '../src/world/Effects';
import { Player } from '../src/player/Player';
import { AudioManager } from '../src/audio/AudioManager';
import { Game } from '../src/game/Game';
import { GameState, isGameplay } from '../src/game/GameState';
import { disposeScene } from '../src/world/disposeScene';
import {
  FIELD_BOUNDS,
  FIELD_SPAWN,
  FIELD_CHECKPOINT,
  FIELD_ENCOUNTERS,
  ELDER_POSITION,
  ELDER_STORY,
  VILLAGE,
  isFieldSanctuary,
  canLeaveCastle,
} from '../src/world/GreenfieldsConfig';

const gradient = { addColorStop() {} };
Object.assign(globalThis, {
  document: {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        fillRect() {},
        createRadialGradient: () => gradient,
        createLinearGradient: () => gradient,
      }),
    }),
  },
  window: { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1 },
});

async function testAssets() {
  const data = await readFile(new URL('../public/models/greenfields-kit.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    '',
  );
  return new FieldAssets(gltf.scene);
}
FieldAssets.load = testAssets;
FirstlightAssets.load = loadFirstlightAssets;

test('every Blender prefab has finite geometry, vertex colors, UVs and usable animation pivots', async () => {
  const assets = await testAssets();
  const manifest = JSON.parse(
    await readFile(new URL('../art/blender/asset-manifest.json', import.meta.url), 'utf8'),
  );
  assert.equal(Object.keys(manifest).length, 35);
  for (const name of Object.keys(manifest)) {
    const root = assets.clone(name);
    let meshCount = 0;
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      meshCount++;
      const { position, normal, color, uv } = object.geometry.attributes;
      assert.ok(position && normal && color && uv, `${name}: missing vertex attributes`);
      assert.equal(color.count, position.count, `${name}: incomplete paint`);
      assert.equal(uv.count, position.count, `${name}: incomplete UVs`);
      for (const value of position.array)
        assert.ok(Number.isFinite(value), `${name}: invalid vertex`);
    });
    assert.ok(meshCount > 0, `${name}: empty model`);
  }
  for (const name of ['wolf', 'golem', 'thornling']) {
    const creature = assets.clone(name);
    for (const part of ['body', 'head', 'limb_0', 'limb_1']) {
      assert.ok(creature.getObjectByName(`${name}_${part}`), `${name}: missing ${part} pivot`);
    }
  }
  assert.ok(assets.clone('windmill').getObjectByName('windmill_sails'));
});

test('movement follows the actual Blender terrain triangles across the meadow and village', async () => {
  const assets = await testAssets();
  const terrain = assets.clone('terrain');
  terrain.updateMatrixWorld(true);
  const collision = new CollisionSystem(FIELD_BOUNDS);
  collision.heightAt = assets.heightAt;
  for (const [x, z] of [
    [-31.7, 12.2],
    [0.3, 31.6],
    [18.8, 4.3],
    [-24.2, -32.6],
    [16.2, -18.5],
    [7.4, -56.8],
  ]) {
    const ray = new THREE.Raycaster(new THREE.Vector3(x, 50, z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(terrain, true)[0];
    assert.ok(hit, `missing terrain at ${x},${z}`);
    assert.ok(
      Math.abs(hit.point.y - assets.heightAt(x, z)) < 0.0002,
      `feet disagree with surface at ${x},${z}`,
    );
    const position = new THREE.Vector3(x - 0.2, 0, z);
    collision.move(position, 0.2, 0, 0.47);
    assert.ok(
      Math.abs(position.y - hit.point.y) < 0.0002,
      `movement left the surface at ${x},${z}`,
    );
  }
});

function flood(c: CollisionSystem, start: { x: number; z: number }) {
  const minX = -c.bounds.halfWidth,
    minZ = c.bounds.minZ;
  const width = c.bounds.halfWidth * 2 + 1,
    height = c.bounds.maxZ - minZ + 1;
  const key = (x: number, z: number) => Math.round(x - minX) + Math.round(z - minZ) * width;
  const visited = new Set<number>([key(start.x, start.z)]),
    queue = [key(start.x, start.z)];
  for (let head = 0; head < queue.length; head++) {
    const x = queue[head] % width,
      z = Math.floor(queue[head] / width);
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        nz = z + dz,
        k = nx + nz * width;
      if (
        nx < 0 ||
        nx >= width ||
        nz < 0 ||
        nz >= height ||
        visited.has(k) ||
        c.blocked(nx + minX, nz + minZ, 0.47)
      )
        continue;
      visited.add(k);
      queue.push(k);
    }
  }
  return (x: number, z: number) => visited.has(key(x, z));
}

test('boss exit remains sealed until its opening animation clears the doorway, and resets', async () => {
  const c = new CollisionSystem(),
    castle = new Castle(c, await loadCastleAssets());
  assert.ok(c.blocked(0, -150, 0.47));
  assert.equal(canLeaveCastle(false, true, 0, -151.5), false);
  assert.equal(canLeaveCastle(true, false, 0, -151.5), false);
  assert.equal(canLeaveCastle(true, true, 6, -151.5), false);
  castle.exitOpened = true;
  castle.update(1, 1, -146);
  assert.equal(castle.exitReady, false);
  castle.update(3, 2, -146);
  assert.equal(castle.exitReady, true);
  assert.equal(c.blocked(0, -150, 0.47), false);
  assert.equal(c.blocked(0, -151.5, 0.47), false);
  assert.equal(canLeaveCastle(true, castle.exitReady, 0, -151.5), true);
  castle.resetExit();
  assert.equal(castle.exitReady, false);
  assert.ok(c.blocked(0, -150, 0.47));
});

test('the meadow entrance, elder, well, checkpoint and every monster are reachable', async () => {
  const c = new CollisionSystem(FIELD_BOUNDS),
    field = await Greenfields.create(c, async () => {});
  const reachable = flood(c, FIELD_SPAWN);
  for (const p of [
    FIELD_SPAWN,
    FIELD_CHECKPOINT,
    { x: 0, z: ELDER_POSITION.z },
    { x: 16, z: -19 },
    { x: MARA_POSITION.x, z: MARA_POSITION.z + 1.5 },
    ...Object.values(FIRSTLIGHT_PARTS),
    ...FIELD_ENCOUNTERS,
  ]) {
    assert.equal(c.blocked(p.x, p.z, 0.47), false, `spawn blocked at ${p.x},${p.z}`);
    assert.ok(reachable(p.x, p.z), `unreachable ${p.x},${p.z}`);
  }
  assert.equal(new Set(FIELD_ENCOUNTERS.map((e) => e.type)).size, 3);
  assert.ok(FIELD_ENCOUNTERS.every((e) => !isFieldSanctuary(e.x, e.z)));
  assert.ok(c.blocked(41, 0, 0.47));
  let meshes = 0;
  field.group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      meshes++;
      const positions = o.geometry.attributes.position;
      assert.ok(positions);
      assert.ok(Number.isFinite(positions.getX(0)));
    }
  });
  assert.ok(meshes < 450, `static batching budget exceeded: ${meshes}`);
  const scene = new THREE.Scene();
  scene.add(field.group);
  disposeScene(scene);
});

test('wolves cancel an imminent attack and retreat when the player reaches Firstlight', async () => {
  const c = new CollisionSystem(FIELD_BOUNDS),
    effects = new Effects(true),
    audio = new AudioManager();
  const enemy = new Enemy('wolf', 5, 2, -18, c, effects, audio, (await testAssets()).clone('wolf'));
  const player = new Player(c, effects, audio);
  player.position.set(2.2, 0, -18);
  assert.ok(isFieldSanctuary(player.position.x, player.position.z));
  enemy.position.set(3, 0, -18);
  enemy.state = 'prepare';
  enemy.timer = 0.001;
  enemy.update(0.05, 1, player, new THREE.PerspectiveCamera());
  assert.equal(player.health, 100);
  assert.equal(enemy.state, 'patrol');
  assert.ok(enemy.position.x < 3);
});

test('field enemies retain distinct combat timing and deaths cannot award healing twice', async () => {
  const c = new CollisionSystem(FIELD_BOUNDS),
    effects = new Effects(true),
    audio = new AudioManager();
  const player = new Player(c, effects, audio);
  player.position.set(0, 0, 0);
  player.facing = 0;
  player.hitWindow = true;
  player.health = 50;
  const enemy = new Enemy(
    'thornling',
    5,
    0,
    1.6,
    c,
    effects,
    audio,
    (await testAssets()).clone('thornling'),
  );
  assert.ok(ENEMY_PROFILES.wolf.speed > ENEMY_PROFILES.golem.speed);
  assert.ok(ENEMY_PROFILES.golem.windup > ENEMY_PROFILES.wolf.windup);
  assert.ok(enemy.tryHit(player));
  assert.equal(enemy.tryHit(player), false);
  player.attackId++;
  assert.ok(enemy.tryHit(player));
  assert.equal(enemy.state, 'dead');
  assert.equal(player.health, 55);
  player.attackId++;
  assert.equal(enemy.tryHit(player), false);
  assert.equal(player.health, 55);
});

test('map cleanup disposes shared geometry, materials and textures once', () => {
  const scene = new THREE.Scene(),
    geo = new THREE.BoxGeometry(),
    tex = new THREE.Texture(),
    mat = new THREE.MeshStandardMaterial({ map: tex });
  const counts = { geo: 0, mat: 0, tex: 0 };
  geo.addEventListener('dispose', () => counts.geo++);
  mat.addEventListener('dispose', () => counts.mat++);
  tex.addEventListener('dispose', () => counts.tex++);
  scene.add(new THREE.Mesh(geo, mat), new THREE.Mesh(geo, mat));
  scene.environment = tex;
  disposeScene(scene);
  assert.deepEqual(counts, { geo: 1, mat: 1, tex: 1 });
  assert.equal(scene.children.length, 0);
  assert.equal(scene.environment, null);
});

// Exercise the real chapter-loading orchestration with only GPU/DOM edges substituted.
function gameHarness() {
  const game = Object.create(Game.prototype) as any;
  const messages: string[] = [];
  const loadingProgress: number[] = [];
  const oldScene = new THREE.Scene();
  oldScene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
  Object.assign(game, {
    state: GameState.PLAYING,
    chapter: 'castle',
    scene: oldScene,
    time: 0,
    storyPage: 0,
    firstlight: new FirstlightQuest(),
    journeySave: new JourneySave(),
    savedJourney: null,
    preview: true,
    storyRead: false,
    elderGreeted: false,
    villageFound: false,
    input: { enabled: true, clear() {} },
    audio: new AudioManager(),
    camera: { snap() {}, update() {}, camera: new THREE.PerspectiveCamera() },
    renderer: {
      compileAsync: async () => {},
      domElement: { focus() {} },
      setPixelRatio() {},
      shadowMap: {},
    },
    hud: {
      setState() {},
      loading(progress: number) {
        loadingProgress.push(progress);
      },
      chapter() {},
      memory() {},
      saveStatus() {},
      continueAvailable() {},
      journal() {},
      location() {},
      objective() {},
      toast(t: string) {
        messages.push(t);
      },
      dialogue() {},
      settings: {
        quality: 'low',
        shadows: 'low',
        reflections: 'low',
        particles: 'low',
        audio: false,
      },
    },
    paint: async () => {},
  });
  return { game, oldScene, messages, loadingProgress };
}

test('chapter loading releases the castle and builds exactly one field map on repeated triggers', async () => {
  const { game, oldScene, loadingProgress } = gameHarness();
  const first = game.enterFields();
  assert.equal(game.state, GameState.TRANSITION);
  assert.equal(game.input.enabled, false);
  await game.enterFields();
  await first;
  assert.equal(oldScene.children.length, 0);
  assert.equal(game.chapter, 'fields');
  assert.equal(game.state, GameState.PLAYING);
  assert.ok(loadingProgress.length >= 14);
  assert.deepEqual(
    loadingProgress,
    [...loadingProgress].sort((a, b) => a - b),
  );
  assert.equal(loadingProgress.at(-1), 100);
  assert.equal(game.castle, undefined);
  assert.equal(game.boss, undefined);
  assert.equal(game.reflection, undefined);
  assert.equal(game.enemies.length, FIELD_ENCOUNTERS.length);
  assert.deepEqual(game.collision.bounds, FIELD_BOUNDS);
  assert.equal(game.player.position.z, FIELD_SPAWN.z);
  const scene = game.scene;
  await game.enterFields();
  assert.equal(game.scene, scene);
  disposeScene(game.scene);
});

test('elder dialogue freezes combat, supports leaving early and finishes back in exploration', async () => {
  const { game } = gameHarness();
  await game.enterFields();
  game.startStory();
  assert.equal(game.state, GameState.DIALOGUE);
  assert.equal(isGameplay(game.state), false);
  assert.equal(game.input.enabled, false);
  game.leaveStory();
  assert.equal(game.state, GameState.PLAYING);
  assert.equal(game.elderGreeted, true);
  assert.equal(game.storyRead, false);
  game.startStory();
  for (let i = 0; i < ELDER_STORY.length; i++) game.advanceStory();
  assert.equal(game.storyRead, true);
  assert.equal(game.state, GameState.PLAYING);
  assert.equal(game.input.enabled, true);
  disposeScene(game.scene);
});

test('death in the fields respawns at the village without reviving defeated monsters', async () => {
  const { game } = gameHarness();
  await game.enterFields();
  game.villageFound = true;
  game.player.health = 0;
  game.enemies[0].health = 0;
  game.enemies[0].state = 'dead';
  game.audio.start = async () => {};
  game.state = GameState.PLAYER_DEAD;
  game.restart();
  assert.equal(game.player.health, 100);
  assert.equal(game.player.position.x, FIELD_CHECKPOINT.x);
  assert.equal(game.player.position.z, FIELD_CHECKPOINT.z);
  assert.equal(game.enemies[0].health, 0);
  assert.equal(game.state, GameState.PLAYING);
  game.quit();
  assert.equal(game.state, GameState.MENU);
  game.play();
  assert.equal(game.state, GameState.PLAYING);
  assert.equal(game.chapter, 'fields');
  disposeScene(game.scene);
});

test('Mara repair changes the world once, pauses safely, and survives retry and saved chapter loading', async () => {
  const { game } = gameHarness();
  let raw: string | null = null;
  let writes = 0;
  const storage = {
    getItem: () => raw,
    setItem: (_: string, value: string) => {
      raw = value;
      writes++;
    },
    removeItem: () => {
      raw = null;
    },
  };
  game.preview = false;
  game.journeySave = new JourneySave(storage);
  await game.enterFields();
  const sails = game.fields.group.getObjectByName('windmill_sails');
  const still = sails.rotation.z;
  game.fields.update(1);
  assert.equal(sails.rotation.z, still);
  game.startMara();
  game.leaveStory();
  assert.equal(game.firstlight.accepted, false, 'leaving early must not commit a quest');
  for (const id of ['sunwheel', 'winding'] as const) {
    const part = FIRSTLIGHT_PARTS[id];
    game.player.reset(part.z, part.x);
    game.interactFields();
    assert.equal(game.firstlight.has(id), true);
    assert.equal(game.fields.group.getObjectByName(`Recoverable ${part.name}`).visible, false);
    const count = writes;
    game.interactFields();
    assert.equal(writes, count, 'duplicate recovery must not save again');
  }
  const finish = () => {
    while (game.state === GameState.DIALOGUE) game.advanceStory();
  };
  game.player.reset(MARA_POSITION.z + 1.5, MARA_POSITION.x);
  game.interactFields();
  finish();
  assert.equal(game.firstlight.ready, true);
  game.interactFields();
  game.leaveStory();
  assert.equal(game.firstlight.restored, false, 'leaving turn-in early must not award the upgrade');
  game.interactFields();
  finish();
  assert.equal(game.firstlight.restored, true);
  assert.equal(game.player.maxStamina, 120);
  assert.equal(game.player.stamina, 120);
  assert.equal(
    game.collision.blocked(25.35, -34.15, 0.47),
    true,
    'restored supplies must have collision',
  );
  const restoredPaths = flood(game.collision, FIELD_CHECKPOINT);
  for (const p of [FIELD_CHECKPOINT, { x: 16, z: -19 }, { x: 12, z: -17.5 }, { x: 18, z: -20 }]) {
    assert.equal(game.collision.blocked(p.x, p.z, 0.47), false);
    assert.ok(restoredPaths(p.x, p.z), 'repair must preserve village access');
  }
  assert.equal(
    game.fields.group.getObjectByName('Firstlight restored · supplies flowers and lanterns')
      .visible,
    true,
  );
  game.fields.update(1.05);
  assert.ok(sails.rotation.z < still);
  game.interactFields();
  finish();
  assert.equal(game.player.maxStamina, 120);
  game.toggleJournal();
  assert.equal(game.state, GameState.JOURNAL);
  assert.equal(isGameplay(game.state), false);
  assert.equal(game.input.enabled, false);
  game.toggleJournal();
  assert.equal(game.state, GameState.PLAYING);
  assert.equal(game.input.enabled, true);
  game.player.stamina = 119.9;
  game.player.update(0.05, 2, { down: () => false, consume: () => false } as any, null);
  assert.equal(game.player.stamina, 120, 'regeneration must use the upgraded capacity');
  game.storyRead = true;
  game.elderGreeted = true;
  game.villageFound = true;
  game.enemies[0].health = 0;
  game.enemies[0].state = 'dead';
  game.persistJourney();
  game.audio.start = async () => {};
  game.player.health = 0;
  game.state = GameState.PLAYER_DEAD;
  game.restart();
  assert.equal(game.player.stamina, 120);
  const resumed = gameHarness().game;
  await resumed.enterFields(new JourneySave(storage).load());
  assert.equal(resumed.player.maxStamina, 120);
  assert.equal(resumed.player.stamina, 120);
  assert.equal(resumed.player.position.x, FIELD_CHECKPOINT.x);
  assert.equal(resumed.player.position.z, FIELD_CHECKPOINT.z);
  assert.equal(resumed.storyRead, true);
  assert.equal(resumed.firstlight.restored, true);
  assert.equal(resumed.enemies[0].state, 'dead');
  assert.equal(resumed.enemies[0].model.group.visible, false);
  assert.ok(writes < 12, `unexpected repeated writes: ${writes}`);
  disposeScene(game.scene);
  disposeScene(resumed.scene);
});

test('inspection routes never overwrite normal journey progress', async () => {
  const { game } = gameHarness();
  game.journeySave = {
    save() {
      assert.fail('preview attempted a storage write');
    },
  };
  await game.enterFields();
  game.firstlight.accept();
  game.persistJourney();
  disposeScene(game.scene);
});
