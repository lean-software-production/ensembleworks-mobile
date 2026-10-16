'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TetrisGame } = require('../src/game');
const { TerminalController: publicTerminalController } = require('../src/index');
const { TerminalController } = require('../src/TerminalController');

test('the game module creates a game and preserves the terminal controller export', () => {
  assert.ok(new TetrisGame());
  assert.equal(publicTerminalController, TerminalController);
});
