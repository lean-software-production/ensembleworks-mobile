'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { MAX_DISPLAY_ROWS, TerminalRenderer } = require('../src/renderer');

function snapshot(height = 20) {
  return {
    rows: Array.from({ length: height }, () => Array(10).fill(null)),
    width: 10,
    score: 0,
    lines: 0,
    level: 1,
    gameOver: false
  };
}

test('complete game display fits exactly within the 24-row limit', () => {
  const renderer = new TerminalRenderer({ isTTY: false, write() {} });
  const frame = renderer.frame(snapshot());
  const rows = frame.split('\n');

  assert.equal(rows.length, MAX_DISPLAY_ROWS);
  assert.match(rows[0], /^\+-+\+$/);
  assert.match(rows.at(-2), /^Score 0  Lines 0  Level 1$/);
  assert.match(rows.at(-1), /move.*rotate.*drop.*quit/);
});

test('game-over display stays within the same 24-row limit', () => {
  const renderer = new TerminalRenderer({ isTTY: false, write() {} });
  const gameOver = { ...snapshot(), gameOver: true };
  const rows = renderer.frame(gameOver).split('\n');

  assert.equal(rows.length, MAX_DISPLAY_ROWS);
  assert.match(rows.at(-1), /GAME OVER.*restart.*quit/);
});

test('renderer rejects a frame that exceeds the display-height limit', () => {
  const renderer = new TerminalRenderer({ isTTY: false, write() {} });

  assert.throws(() => renderer.frame(snapshot(21)), /exceeds 24 rows/);
});
