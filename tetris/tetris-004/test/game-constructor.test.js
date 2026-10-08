'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TetrisGame, BOARD_WIDTH, BOARD_HEIGHT } = require('../src/game');

test('TetrisGame constructor uses the standard board and initializes a game', () => {
  const game = new TetrisGame();

  assert.equal(game.width, BOARD_WIDTH);
  assert.equal(game.height, BOARD_HEIGHT);
  assert.equal(game.random, Math.random);
  assert.deepEqual(game.board, Array.from(
    { length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null),
  ));
  assert.equal(game.score, 0);
  assert.equal(game.lines, 0);
  assert.equal(game.level, 1);
  assert.equal(game.gameOver, false);
  assert.deepEqual(game.active, { type: game.active.type, rotation: 0, x: 3, y: 0 });
});

test('TetrisGame constructor accepts board dimensions and a random source', () => {
  const random = () => 0.5;
  const game = new TetrisGame({ width: 6, height: 8, random });

  assert.equal(game.width, 6);
  assert.equal(game.height, 8);
  assert.equal(game.random, random);
  assert.equal(game.board.length, 8);
  assert.ok(game.board.every((row) => row.length === 6 && row.every((cell) => cell === null)));
  assert.deepEqual(game.active, { type: 'S', rotation: 0, x: 1, y: 0 });
});

test('TetrisGame constructor rejects invalid board dimensions', () => {
  for (const dimensions of [
    { width: '10', height: 20 },
    { width: 10, height: '20' },
    { width: 3, height: 20 },
    { width: 10, height: 3 },
  ]) {
    assert.throws(
      () => new TetrisGame(dimensions),
      new RangeError('The board must be at least 4 columns by 4 rows.'),
    );
  }
});
