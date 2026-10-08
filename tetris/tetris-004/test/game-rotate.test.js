'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TetrisGame } = require('../src/game');

test('rotate turns active pieces in both directions, including counter-clockwise wraparound', () => {
  const game = new TetrisGame();
  game.active = { type: 'T', rotation: 0, x: 3, y: 2 };

  assert.equal(game.rotate(), true);
  assert.deepEqual(game.active, { type: 'T', rotation: 1, x: 3, y: 2 });

  assert.equal(game.rotate(-1), true);
  assert.deepEqual(game.active, { type: 'T', rotation: 0, x: 3, y: 2 });

  assert.equal(game.rotate(-1), true);
  assert.deepEqual(game.active, { type: 'T', rotation: 3, x: 3, y: 2 });
});

test('rotate tries wall kicks in order and wraps clockwise rotations', () => {
  const game = new TetrisGame();
  game.active = { type: 'T', rotation: 3, x: 4, y: 2 };
  const attempts = [];
  game.collides = (piece) => {
    attempts.push(piece);
    return piece.x !== 5;
  };

  assert.equal(game.rotate(), true);
  assert.deepEqual(attempts, [
    { type: 'T', rotation: 0, x: 4, y: 2 },
    { type: 'T', rotation: 0, x: 3, y: 2 },
    { type: 'T', rotation: 0, x: 5, y: 2 },
  ]);
  assert.deepEqual(game.active, { type: 'T', rotation: 0, x: 5, y: 2 });
});

test('rotate preserves the active piece when every wall kick is blocked', () => {
  const game = new TetrisGame();
  const active = { type: 'T', rotation: 0, x: 3, y: 2 };
  game.active = active;
  const attempts = [];
  game.collides = (piece) => {
    attempts.push(piece.x - active.x);
    return true;
  };

  assert.equal(game.rotate(), false);
  assert.deepEqual(attempts, [0, -1, 1, -2, 2]);
  assert.equal(game.active, active);
});

test('rotate rejects inactive and game-over games', () => {
  const inactive = new TetrisGame();
  inactive.active = null;
  assert.equal(inactive.rotate(), false);

  const gameOver = new TetrisGame();
  gameOver.gameOver = true;
  assert.equal(gameOver.rotate(), false);
});
