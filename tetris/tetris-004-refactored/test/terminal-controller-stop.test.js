'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TerminalController } = require('../src/TerminalController');

function createInput() {
  const calls = [];
  return {
    calls,
    input: {
      setRawMode: (enabled) => calls.push(['setRawMode', enabled]),
      removeListener: (event, listener) => calls.push(['removeListener', event, listener]),
      pause: () => calls.push(['pause']),
    },
  };
}

test('stop clears controller resources and restores terminal input', (t) => {
  const { calls, input } = createInput();
  const controller = new TerminalController({ input });
  const timer = { id: 'gravity' };
  const originalClearInterval = global.clearInterval;
  const clearedTimers = [];
  global.clearInterval = (value) => clearedTimers.push(value);
  t.after(() => { global.clearInterval = originalClearInterval; });
  controller.running = true;
  controller.timer = timer;
  controller.changedRawMode = true;

  controller.stop();

  assert.equal(controller.running, false);
  assert.equal(controller.timer, null);
  assert.equal(controller.changedRawMode, false);
  assert.deepEqual(clearedTimers, [timer]);
  assert.deepEqual(calls, [
    ['removeListener', 'data', controller.handleInput],
    ['setRawMode', false],
    ['pause'],
  ]);
});

test('stop is a no-op when already stopped', () => {
  const { calls, input } = createInput();
  const controller = new TerminalController({ input });

  controller.stop();
  controller.stop();

  assert.deepEqual(calls, []);
  assert.equal(controller.timer, null);
  assert.equal(controller.changedRawMode, false);
});
