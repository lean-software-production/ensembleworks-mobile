'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TetrisGame } = require('../src/game');

function createGame() {
  const game = new TetrisGame({ width: 4, height: 4, random: () => 0 });
  game.board = Array.from({ length: 4 }, () => Array(4).fill(null));
  return game;
}

test('tick moves an active piece down when space is available', () => {
  const game = createGame();
  game.active = { type: 'O', rotation: 0, x: 0, y: 0 };

  assert.equal(game.tick(), true);
  assert.deepEqual(game.active, { type: 'O', rotation: 0, x: 0, y: 1 });
  assert.deepEqual(game.board, Array.from({ length: 4 }, () => Array(4).fill(null)));
});

test('tick locks a piece that cannot move and continues with the next piece', () => {
  const game = createGame();
  game.active = { type: 'O', rotation: 0, x: 0, y: 2 };

  assert.equal(game.tick(), true);
  assert.deepEqual(game.board, [
    [null, null, null, null],
    [null, null, null, null],
    [null, 'O', 'O', null],
    [null, 'O', 'O', null],
  ]);
  assert.deepEqual(game.active, { type: 'I', rotation: 0, x: 0, y: 0 });
});

test('tick returns false for finished games and when locking ends the game', () => {
  const finished = createGame();
  const active = { ...finished.active };
  finished.gameOver = true;

  assert.equal(finished.tick(), false);
  assert.deepEqual(finished.active, active);

  const blockedSpawn = createGame();
  blockedSpawn.board[1][0] = 'J';
  blockedSpawn.active = { type: 'O', rotation: 0, x: 0, y: 2 };

  assert.equal(blockedSpawn.tick(), false);
  assert.equal(blockedSpawn.gameOver, true);
  assert.equal(blockedSpawn.active, null);
});
