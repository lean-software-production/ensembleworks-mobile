'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TetrisGame } = require('../src/game');

function gameWithEmptyBoard() {
  const game = new TetrisGame({ width: 4, height: 4, random: () => 0 });
  game.board = Array.from({ length: 4 }, () => Array(4).fill(null));
  return game;
}

test('visibleCells lists settled cells in board order before active cells', () => {
  const game = gameWithEmptyBoard();
  game.board[0][3] = 'J';
  game.board[2][1] = 'L';
  game.active = { type: 'O', rotation: 0, x: 0, y: 1 };

  assert.deepEqual(game.visibleCells(), [
    { x: 3, y: 0, type: 'J' },
    { x: 1, y: 2, type: 'L' },
    { x: 1, y: 1, type: 'O' },
    { x: 2, y: 1, type: 'O' },
    { x: 1, y: 2, type: 'O' },
    { x: 2, y: 2, type: 'O' },
  ]);
});

test('visibleCells returns only settled cells without an active piece', () => {
  const game = gameWithEmptyBoard();
  game.board[3][0] = 'T';
  game.active = null;

  assert.deepEqual(game.visibleCells(), [{ x: 0, y: 3, type: 'T' }]);
});

test('visibleCells clips active cells at every board edge', () => {
  const game = gameWithEmptyBoard();
  const positions = [
    { name: 'left', x: -2, y: 0, cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }] },
    { name: 'right', x: 2, y: 0, cells: [{ x: 3, y: 0 }, { x: 3, y: 1 }] },
    { name: 'top', x: 0, y: -1, cells: [{ x: 1, y: 0 }, { x: 2, y: 0 }] },
    { name: 'bottom', x: 0, y: 3, cells: [{ x: 1, y: 3 }, { x: 2, y: 3 }] },
  ];

  for (const { name, x, y, cells } of positions) {
    game.active = { type: 'O', rotation: 0, x, y };
    assert.deepEqual(
      game.visibleCells(),
      cells.map((cell) => ({ ...cell, type: 'O' })),
      name,
    );
  }
});
