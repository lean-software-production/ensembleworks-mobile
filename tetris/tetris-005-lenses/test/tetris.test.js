'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TetrisGame } = require('../src/game');
const { boardCells, renderGame } = require('../src/index');

test('pieces move, lock, clear a line, and score the clear', () => {
  const game = new TetrisGame({ random: () => 0 });
  game.board[game.height - 1] = Array(game.width).fill('I');
  game.board[game.height - 1][1] = null;
  game.board[game.height - 1][2] = null;
  game.current = {
    type: 'O',
    cells: [[1, 0], [2, 0], [1, 1], [2, 1]],
    x: 0,
    y: 0,
  };

  const distance = game.hardDrop();

  assert.equal(distance, 18);
  assert.equal(game.lines, 1);
  assert.equal(game.score, 136); // 18 cells dropped plus a single-line clear.
  assert.ok(game.board[game.height - 2].every((cell) => cell === null));
  assert.deepEqual(game.board[game.height - 1].slice(1, 3), ['O', 'O']);
  assert.ok(game.current, 'a new piece is spawned after locking');
});

test('movement and rotation do not place a piece through board edges', () => {
  const game = new TetrisGame({ random: () => 0 });

  while (game.move(-1, 0)) {}
  assert.equal(game.move(-1, 0), false);

  assert.equal(game.rotate(), true);
  assert.ok(game.cellsFor().every(([x]) => x >= 0 && x < game.width));
});

test('spawning into occupied cells ends the game', () => {
  const game = new TetrisGame({ random: () => 0 });
  game.board = Array.from({ length: game.height }, () => Array(game.width).fill('T'));
  game.nextType = 'O';

  assert.equal(game.spawn(), false);
  assert.equal(game.gameOver, true);
});

test('the default display contains board, status, controls, and no more than 24 rows', () => {
  const game = new TetrisGame({ random: () => 0 });
  const display = renderGame(game);
  const rows = display.split('\n');

  assert.ok(rows.length <= 24, `display has ${rows.length} rows`);
  assert.equal(rows.length, 24);
  assert.match(rows[0], /Score: 0/);
  assert.match(rows.at(-1), /hard drop.*quit/i);
  assert.equal(boardCells(game).length, game.height);
  assert.equal(boardCells(game)[0].length, game.width);
});
