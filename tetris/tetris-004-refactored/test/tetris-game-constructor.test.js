'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TetrisGame, BOARD_WIDTH, BOARD_HEIGHT } = require('../src/game');

test('constructor creates a default board and starts a game', () => {
  const game = new TetrisGame();

  assert.equal(game.width, BOARD_WIDTH);
  assert.equal(game.height, BOARD_HEIGHT);
  assert.equal(game.board.length, BOARD_HEIGHT);
  assert.ok(game.board.every((row) => row.length === BOARD_WIDTH && row.every((cell) => cell === null)));
  assert.equal(game.score, 0);
  assert.equal(game.lines, 0);
  assert.equal(game.level, 1);
  assert.equal(game.gameOver, false);
  assert.ok(game.active);
  assert.equal(typeof game.random, 'function');
});

test('constructor keeps custom dimensions and random source', () => {
  const random = () => 0.99;
  const game = new TetrisGame({ width: 12, height: 8, random });

  assert.equal(game.width, 12);
  assert.equal(game.height, 8);
  assert.equal(game.random, random);
  assert.deepEqual(game.active, { type: 'L', rotation: 0, x: 4, y: 0 });
});

test('constructor rejects non-integer and undersized board dimensions', () => {
  for (const options of [
    { width: 3.5, height: 4 },
    { width: 4, height: 3.5 },
    { width: 3, height: 4 },
    { width: 4, height: 3 },
  ]) {
    assert.throws(
      () => new TetrisGame(options),
      new RangeError('The board must be at least 4 columns by 4 rows.'),
    );
  }
});
