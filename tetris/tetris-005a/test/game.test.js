'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { HEIGHT, TetrisGame, WIDTH } = require('../game');

function gameWithPiece(index) {
  return new TetrisGame(() => index / 7);
}

function occupiedCells(board) {
  return board.flat().filter(Boolean).length;
}

test('moves until a board edge or occupied cell blocks it', () => {
  const game = gameWithPiece(0); // I

  assert.equal(game.move(-1, 0), true);
  assert.equal(game.current.x, 2);
  while (game.move(-1, 0)) {}
  assert.equal(game.current.x, 0);
  assert.equal(game.move(-1, 0), false);

  game.board[1][4] = 'J';
  assert.equal(game.move(1, 0), false);
  assert.equal(game.current.x, 0);
});

test('rotates when clear and rejects a rotation blocked by the floor', () => {
  const game = gameWithPiece(5); // T
  const before = game.current.cells.map(cell => [...cell]);

  assert.equal(game.rotate(), true);
  assert.notDeepEqual(game.current.cells, before);

  const blocked = gameWithPiece(0); // I
  blocked.current.y = HEIGHT - 3;
  assert.equal(blocked.rotate(), false);
  assert.equal(blocked.current.cells[0][1], 1);
});

test('hard drop lands, locks, and spawns a new piece', () => {
  const game = gameWithPiece(3); // O
  game.drop();

  assert.equal(occupiedCells(game.board), 4);
  assert.equal(game.board[HEIGHT - 1][4], 'O');
  assert.equal(game.board[HEIGHT - 1][5], 'O');
  assert.equal(game.current.y, 0);
  assert.equal(game.over, false);
});

test('locking a piece clears multiple lines and awards their score', () => {
  const game = gameWithPiece(3); // O fills columns 4 and 5
  for (const row of [HEIGHT - 2, HEIGHT - 1]) {
    game.board[row] = Array.from({ length: WIDTH }, (_, column) =>
      column === 4 || column === 5 ? null : 'J'
    );
  }

  game.drop();

  assert.equal(game.lines, 2);
  assert.equal(game.score, 300);
  assert.equal(occupiedCells(game.board), 0);
});

test('reports game over when a new piece cannot spawn', () => {
  const game = gameWithPiece(0); // I occupies x 3–6 at local y 1
  for (const [dx, dy] of game.current.cells) {
    game.board[dy][game.current.x + dx] = 'Z';
  }

  game.spawn();

  assert.equal(game.over, true);
  assert.equal(game.move(0, 1), false);
});
