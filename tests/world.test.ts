import test from 'node:test';
import assert from 'node:assert/strict';
import { Castle } from '../src/world/Castle';
import { CollisionSystem } from '../src/game/CollisionSystem';

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

test('all five areas have a traversable route after their guardian seals open', () => {
  const collision = new CollisionSystem(),
    castle = new Castle(collision);
  assert.equal(castle.zoneGroups.length, 5);
  assert.equal(castle.gates.length, 3);
  assert.ok(castle.water.length >= 60);
  for (const zone of [1, 2, 3]) castle.openGate(zone);
  for (const z of [-23, -55, -90, -111, -141])
    assert.ok(reachable(collision, { x: 0, z: 11 }, { x: 0, z }), `route to ${z}`);
});
test('uncleared courtyard seal cannot be bypassed at the edges', () => {
  const collision = new CollisionSystem(),
    castle = new Castle(collision);
  assert.equal(reachable(collision, { x: 0, z: -35 }, { x: 0, z: -50 }), false);
  castle.openGate(1);
  assert.equal(reachable(collision, { x: 0, z: -35 }, { x: 0, z: -50 }), true);
});
test('new journeys restore gate collisions and unread environmental memories', () => {
  const c = new CollisionSystem(),
    castle = new Castle(c);
  castle.openGate(1);
  castle.memories[0].seen = true;
  castle.reset();
  assert.equal(castle.gates[0].blocker.active, true);
  assert.equal(castle.gates[0].opened, false);
  assert.equal(castle.memories[0].seen, false);
});
