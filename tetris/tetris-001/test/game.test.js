'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const {
  PIECE_TYPES,
  TetrisGame,
} = require('../src/game');
const { gravityDelay } = require('../src/index');
const { renderGame } = require('../src/renderer');

test('a seven-piece bag contains every tetromino exactly once', () => {
  const game = new TetrisGame({ autoStart: false, random: () => 0.5 });
  const bag = Array.from({ length: 7 }, () => game.nextPieceType());

  assert.deepEqual([...bag].sort(), [...PIECE_TYPES].sort());
});

test('pieces move only when they remain inside the board', () => {
  const game = new TetrisGame({ width: 4, height: 6, autoStart: false });
  game.spawnPiece('I');

  assert.equal(game.moveLeft(), false);
  assert.equal(game.moveRight(), false);
  assert.equal(game.activePiece.x, 0);
  assert.equal(game.moveDown(), true);
  assert.equal(game.activePiece.y, 1);
});

test('rotation changes occupied cells and remains placeable', () => {
  const game = new TetrisGame({ autoStart: false });
  game.spawnPiece('T');
  const before = game.cellsFor();

  assert.equal(game.rotate(), true);
  assert.notDeepEqual(game.cellsFor(), before);
  assert.equal(game.activePiece.rotation, 1);
  assert.equal(game.canPlace(), true);
});

test('hard drop locks a piece and awards two points per row', () => {
  const game = new TetrisGame({ width: 4, height: 6, autoStart: false, random: () => 0 });
  game.spawnPiece('O');

  assert.equal(game.hardDrop(), 4);
  assert.equal(game.score, 8);
  assert.deepEqual(game.board.slice(-2), [
    [null, 'O', 'O', null],
    [null, 'O', 'O', null],
  ]);
  assert.notEqual(game.activePiece, null);
});

test('locking clears complete lines and updates score, lines, and level', () => {
  const game = new TetrisGame({ width: 4, height: 4, autoStart: false, random: () => 0 });
  game.board[3] = ['J', null, null, 'J'];
  game.spawnPiece('O');

  game.hardDrop();

  assert.equal(game.lines, 1);
  assert.equal(game.level, 1);
  assert.equal(game.score, 104);
  assert.deepEqual(game.board[3], [null, 'O', 'O', null]);
});

test('a blocked spawn ends the game', () => {
  const game = new TetrisGame({ width: 4, height: 4, autoStart: false });
  game.board[0][1] = 'Z';

  assert.equal(game.spawnPiece('O'), false);
  assert.equal(game.gameOver, true);
  assert.equal(game.activePiece, null);
});

test('renderer keeps the full display within 24 rows', () => {
  const game = new TetrisGame({ autoStart: false });
  game.spawnPiece('T');
  const output = renderGame(game);

  assert.equal(output.split('\n').length, 22);
  assert.match(output, /TETRIS/);
  assert.match(output, /Score: 0/);
  assert.match(output, /Controls/);

  game.gameOver = true;
  assert.match(renderGame(game), /GAME OVER/);
});

test('gravity speeds up with a safe minimum delay', () => {
  assert.equal(gravityDelay(1), 750);
  assert.equal(gravityDelay(10), 210);
  assert.equal(gravityDelay(100), 100);
});

test('the terminal entry point renders a complete non-interactive game', () => {
  const entryPoint = path.join(__dirname, '..', 'src', 'index.js');
  const result = spawnSync(process.execPath, [entryPoint], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.equal(result.stdout.trimEnd().split('\n').length, 22);
  assert.match(result.stdout, /TETRIS/);
  assert.match(result.stdout, /Q       Quit/);
});
