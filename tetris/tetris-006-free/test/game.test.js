'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createGame } = require('../src/game');

test('createGame returns game object with required methods', () => {
  const game = createGame();
  
  assert.equal(typeof game.move, 'function');
  assert.equal(typeof game.rotate, 'function');
  assert.equal(typeof game.tick, 'function');
  assert.equal(typeof game.getSnapshot, 'function');
});

test('game snapshot contains expected properties', () => {
  const game = createGame();
  const snapshot = game.getSnapshot();
  
  assert(snapshot.hasOwnProperty('board'));
  assert(snapshot.hasOwnProperty('score'));
  assert(snapshot.hasOwnProperty('lines'));
  assert(snapshot.hasOwnProperty('gameOver'));
  
  assert.equal(Array.isArray(snapshot.board), true);
  assert.equal(snapshot.board.length, 20); // HEIGHT
  assert.equal(snapshot.board[0].length, 10); // WIDTH
});

test('board cells are either 0 (empty) or 1 (occupied)', () => {
  const game = createGame();
  const snapshot = game.getSnapshot();
  
  snapshot.board.forEach(row => {
    row.forEach(cell => {
      assert(cell === 0 || cell === 1, `Cell value ${cell} should be 0 or 1`);
    });
  });
});

test('score starts at 0', () => {
  const game = createGame();
  const snapshot = game.getSnapshot();
  
  assert.equal(snapshot.score, 0);
});

test('lines starts at 0', () => {
  const game = createGame();
  const snapshot = game.getSnapshot();
  
  assert.equal(snapshot.lines, 0);
});

test('gameOver starts as false', () => {
  const game = createGame();
  const snapshot = game.getSnapshot();
  
  assert.equal(snapshot.gameOver, false);
});

test('game can be moved', () => {
  const game = createGame();
  const initialSnapshot = game.getSnapshot();
  const moved = game.move(1, 0);
  const afterMoveSnapshot = game.getSnapshot();
  
  assert.equal(typeof moved, 'boolean');
  // Piece should have moved (or not if blocked)
});

test('game can be rotated', () => {
  const game = createGame();
  const rotated = game.rotate();
  
  assert.equal(typeof rotated, 'boolean');
});

test('game can tick (gravity)', () => {
  const game = createGame();
  const ticked = game.tick();
  
  assert.equal(typeof ticked, 'boolean');
});