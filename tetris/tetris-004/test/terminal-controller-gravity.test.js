'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TerminalController } = require('../src/index');

function withFakeIntervals(t) {
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  const callbacks = [];
  const cleared = [];
  global.setInterval = (callback, delay) => {
    const timer = { callback, delay };
    callbacks.push(timer);
    return timer;
  };
  global.clearInterval = (timer) => cleared.push(timer);
  t.after(() => {
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  });
  return { callbacks, cleared };
}

test('startGravity only schedules one timer for a running controller', (t) => {
  const { callbacks } = withFakeIntervals(t);
  const controller = new TerminalController({ tickMs: 123 });

  controller.startGravity();
  controller.running = true;
  controller.timer = { existing: true };
  controller.startGravity();

  assert.deepEqual(callbacks, []);
  assert.deepEqual(controller.timer, { existing: true });
});

test('startGravity ticks the game and reports each gravity update', (t) => {
  const { callbacks, cleared } = withFakeIntervals(t);
  let ticks = 0;
  const game = { gameOver: false, tick: () => { ticks += 1; } };
  const updates = [];
  const controller = new TerminalController({
    game,
    tickMs: 123,
    onUpdate: (updatedGame) => updates.push(updatedGame),
  });
  controller.running = true;

  controller.startGravity();
  callbacks[0].callback();

  assert.equal(callbacks[0].delay, 123);
  assert.equal(controller.timer, callbacks[0]);
  assert.equal(ticks, 1);
  assert.deepEqual(updates, [game]);
  assert.deepEqual(cleared, []);
});

test('startGravity clears its timer after a game-over tick', (t) => {
  const { callbacks, cleared } = withFakeIntervals(t);
  const game = {
    gameOver: false,
    tick() { this.gameOver = true; },
  };
  const updates = [];
  const controller = new TerminalController({ game, onUpdate: (updatedGame) => updates.push(updatedGame) });
  controller.running = true;

  controller.startGravity();
  const timer = callbacks[0];
  timer.callback();

  assert.deepEqual(updates, [game]);
  assert.deepEqual(cleared, [timer]);
  assert.equal(controller.timer, null);
});
