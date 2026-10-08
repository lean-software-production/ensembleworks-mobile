'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TerminalController } = require('../src/index');

function createInput({ isTTY = true, rawMode = true } = {}) {
  const calls = [];
  const input = {
    isTTY,
    setEncoding: (encoding) => calls.push(['setEncoding', encoding]),
    resume: () => calls.push(['resume']),
    on: (event, listener) => calls.push(['on', event, listener]),
  };
  if (rawMode) input.setRawMode = (enabled) => calls.push(['setRawMode', enabled]);
  return { calls, input };
}

test('start rejects non-interactive input without changing controller state', () => {
  const { calls, input } = createInput({ isTTY: false });
  const controller = new TerminalController({ input });

  assert.throws(
    () => controller.start(),
    { message: 'Terminal Tetris must be started from an interactive terminal.' },
  );
  assert.equal(controller.running, false);
  assert.equal(controller.changedRawMode, false);
  assert.deepEqual(calls, []);
});

test('start configures an interactive input, starts gravity, and announces the game', () => {
  const { calls, input } = createInput();
  const game = {};
  const updates = [];
  const controller = new TerminalController({ game, input, onUpdate: (updated) => updates.push(updated) });
  let gravityStarts = 0;
  controller.startGravity = () => { gravityStarts += 1; };

  controller.start();

  assert.equal(controller.running, true);
  assert.equal(controller.changedRawMode, true);
  assert.deepEqual(calls, [
    ['setRawMode', true],
    ['setEncoding', 'utf8'],
    ['resume'],
    ['on', 'data', controller.handleInput],
  ]);
  assert.equal(gravityStarts, 1);
  assert.deepEqual(updates, [game]);
});

test('start works when the input cannot change raw mode', () => {
  const { calls, input } = createInput({ rawMode: false });
  const controller = new TerminalController({ input });
  controller.startGravity = () => {};

  controller.start();

  assert.equal(controller.running, true);
  assert.equal(controller.changedRawMode, false);
  assert.deepEqual(calls, [
    ['setEncoding', 'utf8'],
    ['resume'],
    ['on', 'data', controller.handleInput],
  ]);
});

test('start is idempotent after the controller is running', () => {
  const { calls, input } = createInput();
  const controller = new TerminalController({ input });
  let gravityStarts = 0;
  let updates = 0;
  controller.startGravity = () => { gravityStarts += 1; };
  controller.onUpdate = () => { updates += 1; };

  controller.start();
  controller.start();

  assert.equal(gravityStarts, 1);
  assert.equal(updates, 1);
  assert.equal(calls.filter(([method]) => method === 'on').length, 1);
});
