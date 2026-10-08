'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { repaint } = require('../src/index');

test('repaint hides the cursor, clears and homes the terminal, then writes the frame', () => {
  const writes = [];
  const game = {
    width: 4,
    height: 4,
    score: 12,
    lines: 3,
    level: 2,
    gameOver: false,
    visibleCells: () => [],
  };

  repaint({ write: (frame) => writes.push(frame) }, game);

  assert.deepEqual(writes, [
    '\u001b[?25l\u001b[2J\u001b[H┌────┐\n│    │\n│    │\n│    │\n│    │\n└────┘\nScore: 12  Lines: 3  Level: 2\n←/→ move  ↓ soft drop  W rotate  Space drop  Q quit',
  ]);
});
