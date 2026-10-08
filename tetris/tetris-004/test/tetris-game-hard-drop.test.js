'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TetrisGame } = require('../src/game');

function createGame() {
  const game = new TetrisGame({ width: 4, height: 4, random: () => 0 });
  game.board = Array.from({ length: 4 }, () => Array(4).fill(null));
  return game;
}

test('hardDrop scores the distance, locks the piece, and spawns the next one', () => {
  const game = createGame();
  game.active = { type: 'O', rotation: 0, x: 0, y: 0 };

  assert.equal(game.hardDrop(), 2);
  assert.equal(game.score, 4);
  assert.deepEqual(game.board, [
    [null, null, null, null],
    [null, null, null, null],
    [null, 'O', 'O', null],
    [null, 'O', 'O', null],
  ]);
  assert.deepEqual(game.active, { type: 'I', rotation: 0, x: 0, y: 0 });
});

test('hardDrop ignores inactive and game-over games', () => {
  const inactive = createGame();
  inactive.active = null;
  const inactiveBoard = inactive.board.map((row) => [...row]);

  assert.equal(inactive.hardDrop(), 0);
  assert.equal(inactive.score, 0);
  assert.deepEqual(inactive.board, inactiveBoard);

  const finished = createGame();
  const active = { ...finished.active };
  finished.gameOver = true;

  assert.equal(finished.hardDrop(), 0);
  assert.equal(finished.score, 0);
  assert.deepEqual(finished.active, active);
});
