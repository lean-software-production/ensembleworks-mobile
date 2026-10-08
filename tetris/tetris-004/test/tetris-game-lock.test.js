'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TetrisGame } = require('../src/game');

function createGame() {
  const game = new TetrisGame({ width: 4, height: 4, random: () => 0 });
  game.board = Array.from({ length: 4 }, () => Array(4).fill(null));
  return game;
}

test('lock ignores inactive and game-over games', () => {
  const inactive = createGame();
  inactive.active = null;
  const inactiveBoard = inactive.board.map((row) => [...row]);

  assert.equal(inactive.lock(), undefined);
  assert.deepEqual(inactive.board, inactiveBoard);

  const finished = createGame();
  finished.gameOver = true;
  const active = { ...finished.active };

  assert.equal(finished.lock(), undefined);
  assert.deepEqual(finished.active, active);
  assert.deepEqual(finished.board, Array.from({ length: 4 }, () => Array(4).fill(null)));
});

test('lock ends the game without writing a piece that remains above the board', () => {
  const game = createGame();
  game.active = { type: 'I', rotation: 1, x: 0, y: -1 };

  game.lock();

  assert.equal(game.gameOver, true);
  assert.equal(game.active, null);
  assert.deepEqual(game.board, Array.from({ length: 4 }, () => Array(4).fill(null)));
});

test('lock writes the active piece and spawns the next one', () => {
  const game = createGame();
  game.active = { type: 'O', rotation: 0, x: 0, y: 2 };

  game.lock();

  assert.deepEqual(game.board, [
    [null, null, null, null],
    [null, null, null, null],
    [null, 'O', 'O', null],
    [null, 'O', 'O', null],
  ]);
  assert.deepEqual(game.active, { type: 'I', rotation: 0, x: 0, y: 0 });
  assert.equal(game.gameOver, false);
});

test('lock scores cleared lines, updates level, and spawns the next piece', () => {
  const game = createGame();
  game.board[2] = ['J', null, null, 'L'];
  game.board[3] = ['S', null, null, 'T'];
  game.active = { type: 'O', rotation: 0, x: 0, y: 2 };
  game.lines = 9;

  game.lock();

  assert.equal(game.score, 300);
  assert.equal(game.lines, 11);
  assert.equal(game.level, 2);
  assert.deepEqual(game.board, Array.from({ length: 4 }, () => Array(4).fill(null)));
  assert.deepEqual(game.active, { type: 'I', rotation: 0, x: 0, y: 0 });
});
