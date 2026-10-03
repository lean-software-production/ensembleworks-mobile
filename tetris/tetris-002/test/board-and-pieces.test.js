'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { Board } = require('../src/board');
const { Piece, PieceSource } = require('../src/pieces');

test('pieces move and rotate without changing the original piece', () => {
  const piece = new Piece('T', [[0, 1, 0], [1, 1, 1]], 2, 3);

  assert.deepEqual(piece.occupiedCells(), [
    { x: 3, y: 3, symbol: 'T' },
    { x: 2, y: 4, symbol: 'T' },
    { x: 3, y: 4, symbol: 'T' },
    { x: 4, y: 4, symbol: 'T' }
  ]);
  assert.deepEqual(piece.moved(-1, 2).occupiedCells(), [
    { x: 2, y: 5, symbol: 'T' },
    { x: 1, y: 6, symbol: 'T' },
    { x: 2, y: 6, symbol: 'T' },
    { x: 3, y: 6, symbol: 'T' }
  ]);
  assert.deepEqual(piece.rotated().occupiedCells(), [
    { x: 2, y: 3, symbol: 'T' },
    { x: 2, y: 4, symbol: 'T' },
    { x: 3, y: 4, symbol: 'T' },
    { x: 2, y: 5, symbol: 'T' }
  ]);
  assert.equal(piece.occupiedCells()[0].x, 3);
});

test('board rejects wall, floor, and occupied-cell collisions', () => {
  const board = new Board(4, 4);
  const block = new Piece('O', [[1]], 1, 1);

  assert.equal(board.canPlace(block), true);
  board.place(block);

  assert.equal(board.canPlace(new Piece('I', [[1]], -1, 0)), false);
  assert.equal(board.canPlace(new Piece('I', [[1]], 4, 0)), false);
  assert.equal(board.canPlace(new Piece('I', [[1]], 0, 4)), false);
  assert.equal(board.canPlace(new Piece('I', [[1]], 1, 1)), false);
  assert.equal(board.canPlace(new Piece('I', [[1]], 0, -1)), true);
});

test('board clears complete lines and drops remaining cells', () => {
  const board = new Board(4, 4);
  board.place(new Piece('T', [[1]], 1, 2));
  board.place(new Piece('I', [[1, 1, 1, 1]], 0, 3));

  assert.equal(board.clearLines(), 1);
  assert.deepEqual(board.snapshot(), [
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, 'T', null, null]
  ]);
});

test('piece source emits each tetromino once per seven-piece bag', () => {
  const source = new PieceSource(() => 0.5);
  const symbols = Array.from({ length: 7 }, () => source.next().occupiedCells()[0].symbol);

  assert.deepEqual(new Set(symbols), new Set(['I', 'J', 'L', 'O', 'S', 'T', 'Z']));
});
