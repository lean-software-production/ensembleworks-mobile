'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TetrisGame } = require('../src/tetris');

test('a falling piece moves, locks at the floor, and spawns its successor', () => {
  const game = new TetrisGame({ random: () => 0 });
  const firstPiece = game.current;

  const distance = game.hardDrop();

  assert.equal(distance, 18);
  assert.equal(game.gameOver, false);
  assert.notEqual(game.current, firstPiece);
  assert.equal(game.board[19].filter(Boolean).length, 4);
  assert.equal(game.current.type, 'I');
});

test('locking a piece completes a line and applies the single-line score', () => {
  const game = new TetrisGame({ random: () => 0 });
  game.board[19] = Array.from({ length: 10 }, (_, column) => (column < 4 ? null : 'J'));
  game.current = { type: 'I', cells: [[0, 0], [1, 0], [2, 0], [3, 0]], x: 0, y: 19 };

  game.tick();

  assert.equal(game.lines, 1);
  assert.equal(game.level, 1);
  assert.equal(game.score, 100);
  assert.deepEqual(game.board[19], Array(10).fill(null));
});

test('rotation and lateral movement cannot place a piece outside the board', () => {
  const game = new TetrisGame({ random: () => 0 });

  while (game.moveLeft()) {}
  game.rotate();

  for (const [x, y] of game.cellsFor()) {
    assert.ok(x >= 0 && x < game.width);
    assert.ok(y >= 0 && y < game.height);
  }
});

test('a blocked spawn ends the game', () => {
  const game = new TetrisGame({ random: () => 0 });
  game.nextType = 'O';
  game.board[0][4] = 'J';

  assert.equal(game.spawn(), false);
  assert.equal(game.gameOver, true);
});
