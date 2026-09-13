import { loadCastleAssets } from './fixtures/castle-assets';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Castle } from '../src/world/Castle';
import { CollisionSystem } from '../src/game/CollisionSystem';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';

// Canvas is only used to author small material textures. Geometry and collision
// are real Three.js objects; a GPU is unnecessary for these topology tests.
const gradient = { addColorStop() {} };
Object.assign(globalThis, {
  document: {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        fillStyle: '',
        fillRect() {},
        createLinearGradient: () => gradient,
        createRadialGradient: () => gradient,
      }),
    }),
  },
});

function reachable(
  c: CollisionSystem,
  start: { x: number; z: number },
  target: { x: number; z: number },
) {
  const step = 0.5,
    minX = -12.5,
    minZ = -152.5,
    width = 51,
    height = 339;
  const toCell = (x: number, z: number) => ({
    x: Math.round((x - minX) / step),
    z: Math.round((z - minZ) / step),
  });
  const s = toCell(start.x, start.z),
    t = toCell(target.x, target.z);
  const visited = new Uint8Array(width * height),
    queue = [s.x + s.z * width];
  visited[queue[0]] = 1;
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head],
      x = cell % width,
      z = Math.floor(cell / width);
    if (x === t.x && z === t.z) return true;
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        nz = z + dz;
      if (nx < 0 || nx >= width || nz < 0 || nz >= height) continue;
      const key = nx + nz * width;
      if (visited[key] || c.blocked(minX + nx * step, minZ + nz * step, 0.47)) continue;
      visited[key] = 1;
      queue.push(key);
    }
  }
  return false;
}

test('all five areas have a traversable route after their guardian seals open', async () => {
  const collision = new CollisionSystem(),
    castle = new Castle(collision, await loadCastleAssets());
  assert.equal(castle.zoneGroups.length, 5);
  assert.equal(castle.gates.length, 3);
  assert.ok(castle.water.length >= 60);
  for (const zone of [1, 2, 3]) castle.openGate(zone);
  for (const z of [-23, -55, -90, -111, -141])
    assert.ok(reachable(collision, { x: 0, z: 11 }, { x: 0, z }), `route to ${z}`);
});
test('uncleared courtyard seal cannot be bypassed at the edges', async () => {
  const collision = new CollisionSystem(),
    castle = new Castle(collision, await loadCastleAssets());
  assert.equal(reachable(collision, { x: 0, z: -35 }, { x: 0, z: -50 }), false);
  castle.openGate(1);
  assert.equal(reachable(collision, { x: 0, z: -35 }, { x: 0, z: -50 }), true);
});
test('new journeys restore gate collisions and unread environmental memories', async () => {
  const c = new CollisionSystem(),
    castle = new Castle(c, await loadCastleAssets());
  castle.openGate(1);
  castle.memories[0].seen = true;
  castle.reset();
  assert.equal(castle.gates[0].blocker.active, true);
  assert.equal(castle.gates[0].opened, false);
  assert.equal(castle.memories[0].seen, false);
});

test('Blender castle assets have complete meshes, ground-level floors and a clear portal', async () => {
  const assets = await loadCastleAssets();
  const manifest = JSON.parse(
    await readFile(new URL('../art/blender/castle-manifest.json', import.meta.url), 'utf8'),
  );
  assert.equal(Object.keys(manifest).length, 35);
  for (const name of Object.keys(manifest)) {
    let triangles = 0;
    assets.clone(name).traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const { position, normal, color, uv } = object.geometry.attributes;
      assert.ok(position && normal && color && uv, `${name}: missing geometry attributes`);
      for (const value of position.array)
        assert.ok(Number.isFinite(value), `${name}: invalid vertex`);
      triangles += (object.geometry.index?.count ?? position.count) / 3;
    });
    assert.ok(triangles > 0, `${name}: empty prefab`);
  }
  for (const name of ['flagstone_0', 'flagstone_1', 'flagstone_2']) {
    const tile = assets.clone(name);
    tile.updateMatrixWorld(true);
    const hits = new THREE.Raycaster(
      new THREE.Vector3(0.3, 2, 0.2),
      new THREE.Vector3(0, -1, 0),
    ).intersectObject(tile, true);
    assert.ok(hits.length > 0);
    assert.ok(Math.abs(hits[0].point.y) < 0.02, `${name}: walking surface raised above the player`);
  }
  const portal = assets.clone('portal');
  portal.updateMatrixWorld(true);
  assert.equal(
    new THREE.Raycaster(new THREE.Vector3(0, 1.5, 3), new THREE.Vector3(0, 0, -1)).intersectObject(
      portal,
      true,
    ).length,
    0,
  );
  const castle = new Castle(new CollisionSystem(), assets);
  assert.doesNotThrow(
    () => castle.update(2, 0.016, -110),
    'sanctuary crystal must retain its animation pivot',
  );
});

test('Blender threshold has depth, feathered rays and shadow-casting light behind moving ironwork', async () => {
  const castle = new Castle(new CollisionSystem(), await loadCastleAssets());
  const exit = castle.exit,
    root = exit.group;
  const vault = root.getObjectByName('threshold_vault')!;
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(vault);
  assert.ok(
    bounds.max.z - bounds.min.z > 8,
    'a passage with depth replaces the luminous rectangle',
  );
  const rays: THREE.Mesh[] = [];
  let lamp: THREE.SpotLight | undefined;
  root.traverse((p) => {
    if (p instanceof THREE.Mesh && p.name.startsWith('threshold_ray_')) rays.push(p);
    if (p instanceof THREE.SpotLight) lamp = p;
  });
  assert.equal(rays.length, 7);
  for (const ray of rays) {
    const colors = ray.geometry.getAttribute('color');
    assert.equal(colors.itemSize, 4);
    const alpha = Array.from({ length: colors.count }, (_, i) => colors.getW(i));
    assert.ok(Math.min(...alpha) < 0.001 && Math.max(...alpha) > 0.05 && Math.max(...alpha) < 0.12);
    assert.equal(ray.castShadow, false);
  }
  assert.ok(lamp?.castShadow);
  assert.equal(lamp!.intensity, 0);
  exit.update(1, 1, true);
  assert.equal(exit.ready, false);
  exit.update(3.4, 4.4, true);
  assert.equal(exit.ready, true);
  assert.ok(root.getObjectByName('threshold_counterweight_1')!.position.y < -5);
  assert.ok(lamp!.intensity > 250);
  exit.reset();
  assert.equal(exit.ready, false);
  assert.equal(lamp!.intensity, 0);
});
