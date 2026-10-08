'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TetrisGame } = require('../src/game');

const EMPTY_ROW = [null, null, null, null];
const RETAINED_ROWS = [
  ['A', null, null, null],
  [null, 'B', null, null],
  [null, null, 'C', null],
  [null, null, null, 'D'],
];

function createGame() {
  return new TetrisGame({ width: 4, height: 4, random: () => 0 });
}

for (let cleared = 0; cleared <= 4; cleared += 1) {
  test(`clearLines removes ${cleared} full row${cleared === 1 ? '' : 's'}`, () => {
    const game = createGame();
    const retained = RETAINED_ROWS.slice(0, 4 - cleared).map((row) => [...row]);
    const fullRows = Array.from({ length: cleared }, () => Array(4).fill('X'));
    game.board = [...retained.slice(0, 1), ...fullRows, ...retained.slice(1)];

    assert.equal(game.clearLines(), cleared);
    assert.deepEqual(game.board, [
      ...Array.from({ length: cleared }, () => [...EMPTY_ROW]),
      ...retained,
    ]);
  });
}
