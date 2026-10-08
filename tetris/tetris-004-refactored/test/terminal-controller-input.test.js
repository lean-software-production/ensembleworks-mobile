'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TerminalController } = require('../src/TerminalController');

function createController({ gameOver = false, move = () => true, rotate = () => true } = {}) {
  const calls = [];
  const game = {
    gameOver,
    move: (...args) => {
      calls.push(['move', ...args]);
      return move(...args);
    },
    rotate: (...args) => {
      calls.push(['rotate', ...args]);
      return rotate(...args);
    },
    tick: () => calls.push(['tick']),
    hardDrop: () => calls.push(['hardDrop']),
    reset: () => {
      calls.push(['reset']);
      game.gameOver = false;
    },
  };
  const updates = [];
  const controller = new TerminalController({ game, onUpdate: (updated) => updates.push(updated) });
  return { calls, controller, game, updates };
}

test('handleInput accepts every movement, rotation, drop, and arrow alias', () => {
  const { calls, controller, updates } = createController();

  controller.handleInput('aA\u001b[DdD\u001b[CsS\u001b[BwWxX\u001b[AzZ ');

  assert.deepEqual(calls, [
    ['move', -1], ['move', -1], ['move', -1],
    ['move', 1], ['move', 1], ['move', 1],
    ['tick'], ['tick'], ['tick'],
    ['rotate'], ['rotate'], ['rotate'], ['rotate'], ['rotate'],
    ['rotate', -1], ['rotate', -1],
    ['hardDrop'],
  ]);
  assert.deepEqual(updates, [controller.game]);
});

test('handleInput processes mixed batches in order and ignores unknown keys', () => {
  const { calls, controller, updates } = createController();

  controller.handleInput('a?\u001b[CsZ ');

  assert.deepEqual(calls, [
    ['move', -1], ['move', 1], ['tick'], ['rotate', -1], ['hardDrop'],
  ]);
  assert.deepEqual(updates, [controller.game]);
});

test('handleInput only updates for successful moves or rotations, but always for drops', () => {
  const { calls, controller, updates } = createController({
    move: () => false,
    rotate: () => false,
  });

  controller.handleInput('aw');
  assert.deepEqual(calls, [['move', -1], ['rotate']]);
  assert.deepEqual(updates, []);

  controller.handleInput('s ');
  assert.deepEqual(calls, [['move', -1], ['rotate'], ['tick'], ['hardDrop']]);
  assert.deepEqual(updates, [controller.game]);
});

test('handleInput restarts only after game over and reports the restart', () => {
  const active = createController();
  let activeGravityStarts = 0;
  active.controller.startGravity = () => { activeGravityStarts += 1; };
  active.controller.handleInput('rR');
  assert.deepEqual(active.calls, []);
  assert.equal(activeGravityStarts, 0);
  assert.deepEqual(active.updates, []);

  const finished = createController({ gameOver: true });
  let gravityStarts = 0;
  finished.controller.startGravity = () => { gravityStarts += 1; };
  finished.controller.handleInput('rR');
  assert.deepEqual(finished.calls, [['reset']]);
  assert.equal(gravityStarts, 1);
  assert.deepEqual(finished.updates, [finished.game]);
});

test('handleInput quits for Ctrl-C and Q aliases without processing later keys or updating', () => {
  for (const quitKey of ['\u0003', 'q', 'Q']) {
    const { calls, controller, updates } = createController();
    let quits = 0;
    controller.quit = () => { quits += 1; };

    controller.handleInput(`a${quitKey}d`);

    assert.equal(quits, 1, quitKey);
    assert.deepEqual(calls, [['move', -1]], quitKey);
    assert.deepEqual(updates, [], quitKey);
  }
});
