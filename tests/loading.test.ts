import test from 'node:test';
import assert from 'node:assert/strict';
import { HUD } from '../src/ui/HUD';
import { Game } from '../src/game/Game';

// Substitute only the DOM edge; exercise the actual loading timer and state methods.
test('long waits keep real progress unchanged, and completion or errors stop activity', (t) => {
  const elements: Record<string, any> = {};
  for (const id of [
    'loading',
    'load-elapsed',
    'load-activity',
    'load-reassurance',
    'load-label',
    'load-progress',
    'load-percent',
    'load-track',
  ]) {
    const classes = new Set<string>();
    elements[id] = {
      textContent: '',
      style: {},
      attributes: {},
      setAttribute(key: string, value: string) {
        this.attributes[key] = value;
      },
      classList: {
        add: (name: string) => classes.add(name),
        remove: (name: string) => classes.delete(name),
        contains: (name: string) => classes.has(name),
      },
    };
  }
  const hud = Object.create(HUD.prototype) as any;
  hud.elements = elements;
  hud.setState = () => hud.beginLoading();
  t.after(() => hud.endLoading());
  hud.loading(28, 'Opening the Greenfields…');
  const timer = hud.loadingTimer;
  hud.loading(28, 'Opening the Greenfields…');
  assert.equal(hud.loadingTimer, timer, 'one timer per loading session');
  hud.loadingStarted = performance.now() - 35100;
  hud.updateLoadingFeedback();
  assert.equal(elements['load-elapsed'].textContent, '35s elapsed');
  assert.match(elements['load-reassurance'].textContent, /longer than usual/);
  assert.equal(elements['load-percent'].textContent, '28%');
  assert.equal(elements['load-progress'].style.width, '28%');
  assert.equal(elements['loading'].attributes['aria-busy'], 'true');
  hud.loading(100, 'Ready');
  assert.equal(hud.loadingTimer, undefined);
  assert.equal(elements['loading'].attributes['aria-busy'], 'false');
  hud.loading(6, 'A new journey');
  assert.equal(elements['load-elapsed'].textContent, '0s elapsed');
  hud.error('Could not load this scene.');
  assert.equal(hud.loadingTimer, undefined);
  assert.equal(elements['loading'].classList.contains('is-loading'), false);
  assert.match(elements['load-reassurance'].textContent, /Loading stopped/);
});

test('scene construction waits until a loading update has had a frame to paint', async (t) => {
  const previous = globalThis.requestAnimationFrame;
  const callbacks: FrameRequestCallback[] = [];
  globalThis.requestAnimationFrame = (callback) => {
    callbacks.push(callback);
    return callbacks.length;
  };
  t.after(() => {
    globalThis.requestAnimationFrame = previous;
  });
  const game = Object.create(Game.prototype) as any;
  let resumed = false;
  const pending = game.paint().then(() => {
    resumed = true;
  });
  assert.equal(callbacks.length, 1);
  callbacks.shift()!(0);
  await Promise.resolve();
  assert.equal(resumed, false, 'do not start heavy work in the first pre-paint callback');
  assert.equal(callbacks.length, 1);
  callbacks.shift()!(16);
  await pending;
  assert.equal(resumed, true);
});
