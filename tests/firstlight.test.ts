import test from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import * as THREE from 'three';
import {
  FirstlightQuest,
  validateFirstlight,
  type FirstlightPart,
} from '../src/progression/FirstlightQuest';
import {
  JourneySave,
  JOURNEY_SAVE_KEY,
  parseJourney,
  type JourneySnapshot,
} from '../src/progression/JourneySave';
import { loadFirstlightAssets } from './fixtures/firstlight-assets';

const snapshot = (): JourneySnapshot => ({
  discipline: null,
  version: 1,
  chapter: 'fields',
  storyRead: true,
  elderGreeted: true,
  villageFound: true,
  defeated: ['briar-path'],
  firstlight: { accepted: true, recovered: ['winding'], restored: false },
});

test('components work in either order before acceptance and the capacitor cannot stack', () => {
  for (const order of [
    ['winding', 'sunwheel'],
    ['sunwheel', 'winding'],
  ] as FirstlightPart[][]) {
    const quest = new FirstlightQuest();
    assert.equal(quest.restore(), false);
    for (const id of order) {
      assert.equal(quest.recover(id), true);
      assert.equal(quest.recover(id), false);
    }
    assert.equal(quest.ready, false);
    assert.equal(quest.accept(), true);
    assert.equal(quest.accept(), false);
    assert.equal(quest.ready, true);
    const copy = quest.snapshot();
    copy.recovered.length = 0;
    assert.equal(quest.ready, true);
    assert.equal(quest.restore(), true);
    assert.equal(quest.restore(), false);
    assert.equal(quest.energyCapacity, 120);
    assert.equal(new FirstlightQuest(quest.snapshot()).energyCapacity, 120);
  }
});

test('save validation rejects malformed versions and sanitizes unsupported progress', () => {
  for (const raw of [null, '', '{broken', 'null', '[]', '{"version":2,"chapter":"fields"}'])
    assert.equal(parseJourney(raw), null);
  const saved = parseJourney(
    JSON.stringify({
      ...snapshot(),
      elderGreeted: false,
      defeated: ['briar-path', 'briar-path', 'invented', 4],
      firstlight: { accepted: true, recovered: ['winding', 'winding', 'invented'], restored: true },
    }),
  )!;
  assert.deepEqual(saved.defeated, ['briar-path']);
  assert.equal(saved.elderGreeted, true);
  assert.deepEqual(saved.firstlight, { accepted: true, recovered: ['winding'], restored: false });
  assert.equal(
    validateFirstlight({ accepted: 'true', recovered: ['sunwheel', 'winding'], restored: true })
      .restored,
    false,
  );
});

test('milestone saves round-trip, preserve newer data, and clear only the journey key', () => {
  const data = new Map<string, string>([['last-hope-settings', 'keep']]);
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
  const save = new JourneySave(storage);
  assert.equal(save.save(snapshot()), true);
  assert.deepEqual(new JourneySave(storage).load(), snapshot());
  const future = '{"version":9,"chapter":"fields"}';
  data.set(JOURNEY_SAVE_KEY, future);
  assert.equal(save.load(), null);
  assert.equal(save.save(snapshot()), false);
  assert.equal(data.get(JOURNEY_SAVE_KEY), future);
  assert.equal(save.clear(), true);
  assert.equal(data.has(JOURNEY_SAVE_KEY), false);
  assert.equal(data.get('last-hope-settings'), 'keep');
  assert.equal(save.save(snapshot()), true);
});

test('blocked or quota-limited storage does not throw or pretend to save', () => {
  const fail = () => {
    throw new Error('Storage unavailable');
  };
  const blocked = new JourneySave({ getItem: fail, setItem: fail, removeItem: fail });
  assert.equal(blocked.load(), null);
  assert.equal(blocked.save(snapshot()), false);
  assert.equal(blocked.clear(), false);
  const quota = new JourneySave({
    getItem: () => JSON.stringify(snapshot()),
    setItem: fail,
    removeItem: fail,
  });
  assert.deepEqual(quota.load(), snapshot());
  assert.equal(quota.save(snapshot()), false);
});

test('Blender recovery props fit their floating placement and stay within the download budget', async () => {
  const assets = await loadFirstlightAssets();
  assert.ok(
    (await stat(new URL('../public/models/firstlight-kit.glb', import.meta.url))).size < 500_000,
  );
  for (const id of ['winding', 'sunwheel'] as const) {
    const model = assets.clone(id);
    let meshes = 0;
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      meshes++;
      const { position, normal, color, uv } = object.geometry.attributes;
      assert.ok(position && normal && color && uv);
      for (const attribute of [position, normal, color, uv])
        for (const value of attribute.array) assert.ok(Number.isFinite(value));
      assert.equal(color.count, position.count);
    });
    assert.ok(meshes > 0);
    const bounds = new THREE.Box3().setFromObject(model);
    assert.ok(bounds.min.y + 0.32 > 0, `${id} clips through ground at its lowest bob`);
    assert.ok(bounds.getSize(new THREE.Vector3()).length() < 2);
  }
});
