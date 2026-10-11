'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TetrisGame } = require('../src/game');

function createGame({ width = 10, height = 20 } = {}) {
  const game = new TetrisGame({ width, height, random: () => 0 });
  game.board = Array.from({ length: height }, () => Array(width).fill(null));
  return game;
}

test('spawn centers the requested piece at the top of the board', () => {
  const game = createGame({ width: 11 });

  assert.equal(game.spawn('T'), true);
  assert.deepEqual(game.active, { type: 'T', rotation: 0, x: 3, y: 0 });
  assert.equal(game.gameOver, false);
});

test('spawn ends the game and removes the active piece when the spawn area is blocked', () => {
  const game = createGame();
  game.board[0][4] = 'J';

  assert.equal(game.spawn('O'), false);
  assert.equal(game.active, null);
  assert.equal(game.gameOver, true);
});

test('spawn does nothing after the game is over', () => {
  const game = createGame();
  const active = { type: 'L', rotation: 2, x: 2, y: 3 };
  game.active = { ...active };
  game.gameOver = true;

  assert.equal(game.spawn('O'), false);
  assert.deepEqual(game.active, active);
});
