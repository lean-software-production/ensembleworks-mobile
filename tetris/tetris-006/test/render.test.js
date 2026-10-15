'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const { BOARD_HEIGHT, BOARD_WIDTH, emptyBoard, renderFrame } = require('../src/render');

function visibleRows(output) {
  return output.endsWith('\n') ? output.slice(0, -1).split('\n') : output.split('\n');
}

test('empty frame contains a bordered 10 by 20 board, score, and controls', () => {
  const frame = renderFrame({ board: emptyBoard(), score: 0 });
  const rows = visibleRows(frame);

  assert.equal(rows.length, 24);
  assert.equal(rows[0], `┌${'─'.repeat(BOARD_WIDTH * 2)}┐`);
  assert.equal(rows[BOARD_HEIGHT + 1], `└${'─'.repeat(BOARD_WIDTH * 2)}┘`);
  assert.match(rows[BOARD_HEIGHT + 2], /^Score: 0$/);
  assert.match(rows[BOARD_HEIGHT + 3], /Controls:/);
  assert.equal(rows.slice(1, BOARD_HEIGHT + 1).length, BOARD_HEIGHT);
  assert.ok(rows.slice(1, BOARD_HEIGHT + 1).every((row) => /^│ {20}│$/.test(row)));
});

test('renderer remains within the 24-row budget for populated boards and large scores', () => {
  const board = emptyBoard();
  board[0][0] = true;
  board[19][9] = true;
  const frame = renderFrame({ board, score: 1234567890 });

  assert.ok(visibleRows(frame).length <= 24);
  assert.match(frame, /██/);
  assert.match(frame, /Score: 1234567890/);
});

test('npm start output is capturable without an interactive terminal', () => {
  const output = execFileSync(process.execPath, ['src/index.js'], { encoding: 'utf8' });
  const rows = visibleRows(output);

  assert.equal(rows.length, 24);
  assert.match(output, /Score: 0/);
  assert.match(output, /Controls:/);
});
