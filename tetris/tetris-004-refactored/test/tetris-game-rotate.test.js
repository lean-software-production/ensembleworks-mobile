'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TetrisGame } = require('../src/game');

function createGame({ width = 10, height = 20 } = {}) {
  const game = new TetrisGame({ width, height, random: () => 0 });
  game.board = Array.from({ length: height }, () => Array(width).fill(null));
  return game;
}

test('rotate turns active pieces in both directions', () => {
  const game = createGame();
  game.active = { type: 'T', rotation: 0, x: 3, y: 4 };

  assert.equal(game.rotate(), true);
  assert.deepEqual(game.active, { type: 'T', rotation: 1, x: 3, y: 4 });

  assert.equal(game.rotate(-1), true);
  assert.deepEqual(game.active, { type: 'T', rotation: 0, x: 3, y: 4 });
});

test('rotate wraps rotation indices in both directions', () => {
  const clockwise = createGame();
  clockwise.active = { type: 'T', rotation: 3, x: 3, y: 4 };

  assert.equal(clockwise.rotate(1), true);
  assert.deepEqual(clockwise.active, { type: 'T', rotation: 0, x: 3, y: 4 });

  const counterclockwise = createGame();
  counterclockwise.active = { type: 'T', rotation: 0, x: 3, y: 4 };

  assert.equal(counterclockwise.rotate(-1), true);
  assert.deepEqual(counterclockwise.active, { type: 'T', rotation: 3, x: 3, y: 4 });
});

test('rotate uses kicks in order to rotate beside a wall', () => {
  const game = createGame({ width: 4, height: 4 });
  game.active = { type: 'I', rotation: 0, x: 2, y: 0 };

  assert.equal(game.rotate(), true);
  assert.deepEqual(game.active, { type: 'I', rotation: 1, x: 1, y: 0 });
});

test('rotate leaves a piece unchanged when every kick is blocked', () => {
  const game = createGame({ width: 4, height: 4 });
  game.board[0] = ['J', 'J', 'J', 'J'];
  const active = { type: 'I', rotation: 0, x: 0, y: 0 };
  game.active = { ...active };

  assert.equal(game.rotate(), false);
  assert.deepEqual(game.active, active);
});

test('rotate ignores inactive and game-over games', () => {
  const inactive = createGame();
  inactive.active = null;

  assert.equal(inactive.rotate(), false);
  assert.equal(inactive.active, null);

  const finished = createGame();
  const active = { ...finished.active };
  finished.gameOver = true;

  assert.equal(finished.rotate(), false);
  assert.deepEqual(finished.active, active);
});
