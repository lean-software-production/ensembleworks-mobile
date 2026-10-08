'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TetrisGame } = require('../src/game');
const { TerminalController } = require('../src/index');

test('TerminalController initializes default dependencies and inactive state', () => {
  const controller = new TerminalController();

  assert.ok(controller.game instanceof TetrisGame);
  assert.equal(controller.input, process.stdin);
  assert.equal(controller.output, process.stdout);
  assert.equal(controller.tickMs, 700);
  assert.equal(typeof controller.onUpdate, 'function');
  assert.equal(typeof controller.onQuit, 'function');
  assert.equal(controller.running, false);
  assert.equal(controller.timer, null);
  assert.equal(controller.changedRawMode, false);
});

test('TerminalController preserves injected dependencies and binds input handling', () => {
  const calls = [];
  const game = { move: (dx) => calls.push(dx) || true };
  const input = {};
  const output = {};
  const onUpdate = (updatedGame) => calls.push(updatedGame);
  const onQuit = () => calls.push('quit');
  const controller = new TerminalController({
    game, input, output, tickMs: 123, onUpdate, onQuit,
  });
  const handleInput = controller.handleInput;

  assert.equal(controller.game, game);
  assert.equal(controller.input, input);
  assert.equal(controller.output, output);
  assert.equal(controller.tickMs, 123);
  assert.equal(controller.onUpdate, onUpdate);
  assert.equal(controller.onQuit, onQuit);

  handleInput('a');
  assert.deepEqual(calls, [-1, game]);
});
