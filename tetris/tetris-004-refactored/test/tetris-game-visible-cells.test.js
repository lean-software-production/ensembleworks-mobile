'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TetrisGame } = require('../src/game');

function createGame() {
  const game = new TetrisGame({ width: 4, height: 4, random: () => 0 });
  game.board = Array.from({ length: 4 }, () => Array(4).fill(null));
  return game;
}

test('visibleCells lists settled cells before active cells in board and piece order', () => {
  const game = createGame();
  game.board[0][0] = 'L';
  game.board[1][3] = 'S';
  game.active = { type: 'O', rotation: 0, x: 0, y: 2 };

  assert.deepEqual(game.visibleCells(), [
    { x: 0, y: 0, type: 'L' },
    { x: 3, y: 1, type: 'S' },
    { x: 1, y: 2, type: 'O' },
    { x: 2, y: 2, type: 'O' },
    { x: 1, y: 3, type: 'O' },
    { x: 2, y: 3, type: 'O' },
  ]);
});

test('visibleCells omits active cells when there is no active piece', () => {
  const game = createGame();
  game.board[2][1] = 'T';
  game.active = null;

  assert.deepEqual(game.visibleCells(), [{ x: 1, y: 2, type: 'T' }]);
});

test('visibleCells clips active cells at every board boundary', () => {
  const game = createGame();
  game.active = { type: 'I', rotation: 0, x: -2, y: 0 };
  assert.deepEqual(game.visibleCells(), [
    { x: 0, y: 1, type: 'I' },
    { x: 1, y: 1, type: 'I' },
  ]);

  game.active = { type: 'I', rotation: 0, x: 2, y: 0 };
  assert.deepEqual(game.visibleCells(), [
    { x: 2, y: 1, type: 'I' },
    { x: 3, y: 1, type: 'I' },
  ]);

  game.active = { type: 'I', rotation: 1, x: -2, y: -2 };
  assert.deepEqual(game.visibleCells(), [
    { x: 0, y: 0, type: 'I' },
    { x: 0, y: 1, type: 'I' },
  ]);

  game.active = { type: 'I', rotation: 1, x: -2, y: 2 };
  assert.deepEqual(game.visibleCells(), [
    { x: 0, y: 2, type: 'I' },
    { x: 0, y: 3, type: 'I' },
  ]);
});
