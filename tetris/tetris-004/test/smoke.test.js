'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TetrisGame } = require('../src/game');

test('the game module creates a game', () => {
  assert.ok(new TetrisGame());
});
