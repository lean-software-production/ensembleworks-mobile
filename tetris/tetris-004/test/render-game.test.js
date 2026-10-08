'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TetrisGame } = require('../src/game');
const { renderGame } = require('../src/index');

function gameWithVisibleCells() {
  const game = new TetrisGame({ random: () => 0 });
  game.board[0][0] = 'J';
  game.board[19][9] = 'L';
  return game;
}

test('renderGame renders a default 24-row frame with cells, status, and controls', () => {
  const game = gameWithVisibleCells();
  game.score = 120;
  game.lines = 3;
  game.level = 2;

  const rows = renderGame(game).split('\n');

  assert.equal(rows.length, 24);
  assert.equal(rows[0], '┌──────────┐');
  assert.equal(rows[1], '│J         │');
  assert.equal(rows[2], '│   IIII   │');
  assert.equal(rows[20], '│         L│');
  assert.equal(rows[21], '└──────────┘');
  assert.equal(rows[22], 'Score: 120  Lines: 3  Level: 2');
  assert.equal(rows[23], '←/→ move  ↓ soft drop  W rotate  Space drop  Q quit');
});

test('renderGame replaces the center board rows with the game-over message', () => {
  const game = gameWithVisibleCells();
  game.gameOver = true;

  const rows = renderGame(game).split('\n');

  assert.equal(rows[1], '│J         │');
  assert.equal(rows[10], '│GAME OVER!│');
  assert.equal(rows[11], '│R: restart│');
  assert.equal(rows[20], '│         L│');
  assert.equal(rows[22], 'Score: 0  Lines: 0  Level: 1');
});
