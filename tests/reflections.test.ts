import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { WaterReflection, buildPuddleReflectionGeometry } from '../src/world/WaterReflection';

function puddle(x = 0, z = 0) {
  const shape = new THREE.Shape();
  shape.moveTo(-1, -1);
  shape.lineTo(1, -1);
  shape.lineTo(1, 1);
  shape.lineTo(-1, 1);
  shape.closePath();
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.035, z);
  return mesh;
}

function glRenderer() {
  // Only render-target sizing and the reflection camera are exercised here;
  // this does not create a context or claim GPU/visual verification.
  const renderer = Object.create(THREE.WebGLRenderer.prototype) as THREE.WebGLRenderer;
  renderer.getDrawingBufferSize = (out) => out.set(2560, 1440);
  return renderer;
}

test('reflection mask follows individual puddles without bridging dry stone', () => {
  const geometry = buildPuddleReflectionGeometry([puddle(-4, 3), puddle(4, 3)]);
  const positions = geometry.getAttribute('position');
  const indices = geometry.getIndex()!;
  for (let i = 0; i < indices.count; i += 3) {
    const xs = [0, 1, 2].map((offset) => positions.getX(indices.getX(i + offset)));
    assert.ok(xs.every((x) => x <= -3) || xs.every((x) => x >= 3));
  }
  for (let i = 0; i < positions.count; i++) {
    assert.ok(positions.getY(i) >= -4 && positions.getY(i) <= -2);
    assert.equal(positions.getZ(i), 0);
  }
});

test('shoreline opacity fades to zero while the puddle interior remains reflective', () => {
  const geometry = buildPuddleReflectionGeometry([puddle()]);
  const positions = geometry.getAttribute('position');
  const fade = geometry.getAttribute('waterFade');
  let edges = 0;
  let interior = 0;
  for (let i = 0; i < fade.count; i++) {
    if (Math.abs(positions.getX(i)) === 1 || Math.abs(positions.getY(i)) === 1) {
      edges++;
      assert.equal(fade.getX(i), 0);
    } else {
      interior++;
      assert.equal(fade.getX(i), 1);
    }
  }
  assert.equal(edges, 4);
  assert.equal(interior, 5);
});

test('all puddles share one WebGL reflector and quality bounds its render target', async () => {
  const renderer = glRenderer();
  const reflection = await WaterReflection.create(renderer, [puddle(-3), puddle(3)]);
  assert.ok(reflection.surface instanceof Reflector);
  assert.equal(reflection.surface.children.length, 0); // No copied characters.
  reflection.update(1, renderer);
  const target = (reflection.surface as Reflector).getRenderTarget();
  assert.equal(target.width, 768);
  assert.equal(target.height, 432);
  reflection.setQuality('medium');
  reflection.update(2, renderer);
  assert.equal(target.width, 384);
  assert.equal(target.height, 216);
  reflection.setQuality('low');
  assert.equal(reflection.surface.visible, false);
  reflection.setQuality('high');
  assert.equal(reflection.surface.visible, true);
  assert.equal((reflection.surface.material as THREE.Material).depthTest, true);
});

test('the shared reflection camera mirrors the view below the water plane', async () => {
  const renderer = glRenderer();
  const reflection = await WaterReflection.create(renderer, [puddle()]);
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 150);
  camera.position.set(14, 21, 23);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  reflection.surface.updateMatrixWorld();
  let passes = 0;
  Object.assign(renderer, {
    xr: { enabled: false },
    shadowMap: { autoUpdate: true },
    state: { buffers: { depth: { setMask() {} } } },
    getRenderTarget: () => null,
    setRenderTarget() {},
    autoClear: true,
    render(_scene: THREE.Scene, mirrored: THREE.Camera) {
      passes++;
      assert.ok(Math.abs(mirrored.position.y - (0.082 - 21)) < 1e-8);
      assert.equal(mirrored.position.x, 14);
      assert.ok(Math.abs(mirrored.position.z - 23) < 1e-8);
      assert.equal(reflection.surface.visible, false); // No recursive mirror.
    },
  });
  const surface = reflection.surface;
  surface.onBeforeRender(
    renderer,
    new THREE.Scene(),
    camera,
    surface.geometry,
    surface.material as THREE.Material,
    null!,
  );
  assert.equal(passes, 1);
  assert.equal(surface.visible, true);
  assert.equal(renderer.shadowMap.autoUpdate, true);
});

test('WebGPU uses a node reflector and shares the same water mask and quality switch', async () => {
  const renderer = { getDrawingBufferSize: (out: THREE.Vector2) => out.set(1920, 1080) };
  const reflection = await WaterReflection.create(renderer as WebGPURenderer, [puddle()]);
  const material = reflection.surface.material as unknown as {
    isMeshBasicNodeMaterial: boolean;
    colorNode: unknown;
    opacityNode: unknown;
  };
  assert.equal(material.isMeshBasicNodeMaterial, true);
  assert.ok(material.colorNode);
  assert.ok(material.opacityNode);
  assert.ok(reflection.surface.geometry.hasAttribute('waterFade'));
  reflection.update(1, renderer as WebGPURenderer);
  reflection.setQuality('low');
  assert.equal(reflection.surface.visible, false);
});
