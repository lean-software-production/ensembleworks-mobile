'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TerminalController } = require('../src/index');

function inputGame({ gameOver = false, move = () => true, rotate = () => true } = {}) {
  return {
    gameOver,
    move,
    rotate,
    tick() {},
    hardDrop() {},
    reset() {},
  };
}

function controllerFor(game, onUpdate = () => {}) {
  return new TerminalController({ game, onUpdate });
}

test('handleInput recognizes every movement, rotation, drop, and arrow alias', () => {
  const cases = [
    ['a', 'move', [-1]], ['A', 'move', [-1]], ['\u001b[D', 'move', [-1]],
    ['d', 'move', [1]], ['D', 'move', [1]], ['\u001b[C', 'move', [1]],
    ['s', 'tick', []], ['S', 'tick', []], ['\u001b[B', 'tick', []],
    ['w', 'rotate', []], ['W', 'rotate', []], ['x', 'rotate', []], ['X', 'rotate', []], ['\u001b[A', 'rotate', []],
    ['z', 'rotate', [-1]], ['Z', 'rotate', [-1]],
    [' ', 'hardDrop', []],
  ];

  for (const [key, method, args] of cases) {
    const calls = [];
    const updates = [];
    const game = inputGame({
      move: (...received) => { calls.push(['move', received]); return true; },
      rotate: (...received) => { calls.push(['rotate', received]); return true; },
    });
    game.tick = (...received) => calls.push(['tick', received]);
    game.hardDrop = (...received) => calls.push(['hardDrop', received]);

    controllerFor(game, (updated) => updates.push(updated)).handleInput(key);

    assert.deepEqual(calls, [[method, args]], key);
    assert.deepEqual(updates, [game], key);
  }
});

test('handleInput processes batched keys and repaints once for their combined changes', () => {
  const calls = [];
  const updates = [];
  const game = inputGame({
    move: (dx) => { calls.push(`move:${dx}`); return true; },
    rotate: (direction) => { calls.push(`rotate:${direction ?? 1}`); return true; },
  });
  game.tick = () => calls.push('tick');
  game.hardDrop = () => calls.push('drop');
  const controller = controllerFor(game, (updated) => updates.push(updated));

  controller.handleInput('a\u001b[CsWz ');

  assert.deepEqual(calls, ['move:-1', 'move:1', 'tick', 'rotate:1', 'rotate:-1', 'drop']);
  assert.deepEqual(updates, [game]);
});

test('handleInput ignores unknown keys and does not repaint for unsuccessful moves or rotations', () => {
  const updates = [];
  const game = inputGame({ move: () => false, rotate: () => false });
  const controller = controllerFor(game, (updated) => updates.push(updated));

  controller.handleInput('?aWz\u001b[D\u001b[C\u001b[A');

  assert.deepEqual(updates, []);
});

test('handleInput repaints after soft and hard drops even when their game methods return no value', () => {
  const updates = [];
  const game = inputGame();
  const controller = controllerFor(game, (updated) => updates.push(updated));

  controller.handleInput('s ');

  assert.deepEqual(updates, [game]);
});

test('handleInput only restarts a game that is over', () => {
  const updates = [];
  const game = inputGame();
  let resets = 0;
  let gravityStarts = 0;
  game.reset = () => { resets += 1; };
  const controller = controllerFor(game, (updated) => updates.push(updated));
  controller.startGravity = () => { gravityStarts += 1; };

  controller.handleInput('rR');
  assert.equal(resets, 0);
  assert.equal(gravityStarts, 0);
  assert.deepEqual(updates, []);

  game.gameOver = true;
  controller.handleInput('R');
  assert.equal(resets, 1);
  assert.equal(gravityStarts, 1);
  assert.deepEqual(updates, [game]);
});

test('handleInput quits for every quit alias and stops processing immediately', () => {
  for (const key of ['q', 'Q', '\u0003']) {
    const game = inputGame();
    let quits = 0;
    let moves = 0;
    const updates = [];
    game.move = () => { moves += 1; return true; };
    const controller = controllerFor(game, (updated) => updates.push(updated));
    controller.quit = () => { quits += 1; };

    controller.handleInput(`a${key}d`);

    assert.equal(quits, 1, key);
    assert.equal(moves, 1, key);
    assert.deepEqual(updates, [], key);
  }
});
