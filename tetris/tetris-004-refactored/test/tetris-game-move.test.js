'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TetrisGame } = require('../src/game');

function createGame({ width = 10, height = 20 } = {}) {
  const game = new TetrisGame({ width, height, random: () => 0 });
  game.board = Array.from({ length: height }, () => Array(width).fill(null));
  return game;
}

test('move accepts horizontal movement and an optional vertical offset', () => {
  const game = createGame();
  game.active = { type: 'T', rotation: 0, x: 3, y: 4 };

  assert.equal(game.move(1), true);
  assert.deepEqual(game.active, { type: 'T', rotation: 0, x: 4, y: 4 });

  assert.equal(game.move(-1, 2), true);
  assert.deepEqual(game.active, { type: 'T', rotation: 0, x: 3, y: 6 });
});

test('move rejects board-edge and settled-cell collisions without moving the piece', () => {
  const edge = createGame({ width: 4, height: 4 });
  const edgeActive = { type: 'I', rotation: 0, x: 0, y: 2 };
  edge.active = { ...edgeActive };

  assert.equal(edge.move(0, 1), false);
  assert.deepEqual(edge.active, edgeActive);

  const blocked = createGame();
  const blockedActive = { type: 'O', rotation: 0, x: 3, y: 4 };
  blocked.active = { ...blockedActive };
  blocked.board[5][4] = 'J';

  assert.equal(blocked.move(0, 1), false);
  assert.deepEqual(blocked.active, blockedActive);
});

test('move ignores inactive and game-over games', () => {
  const inactive = createGame();
  inactive.active = null;

  assert.equal(inactive.move(1, 1), false);
  assert.equal(inactive.active, null);

  const finished = createGame();
  const active = { ...finished.active };
  finished.gameOver = true;

  assert.equal(finished.move(1, 1), false);
  assert.deepEqual(finished.active, active);
});
