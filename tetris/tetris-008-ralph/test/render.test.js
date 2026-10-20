import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { BOARD_WIDTH, BOARD_HEIGHT, FRAME_ROWS, renderFrame } from '../src/render.js';

function checkFrame(frame) {
  // Do not trim: a trailing newline would occupy an extra terminal row.
  const rows = frame.split('\n');
  assert.equal(rows.length, FRAME_ROWS);
  assert.equal(frame.endsWith('\n'), false);
  assert.equal(BOARD_WIDTH, 10);
  assert.equal(BOARD_HEIGHT, 20);
  const border = '+' + '-'.repeat(20) + '+';
  assert.equal(rows[0], border);
  assert.equal(rows[21], border);
  assert.deepEqual(rows.slice(1, 21), Array(20).fill('|' + ' '.repeat(20) + '|'));
  assert.equal(rows[22], 'Score: 0');
  assert.match(rows[23], /^Controls: /);
  assert.doesNotMatch(frame, /\x1b|\r/);
}

test('pure renderer returns a complete, deterministic 24-row empty board', () => {
  checkFrame(renderFrame());
  assert.equal(renderFrame(), renderFrame());
});

test('npm start launches from target without a TTY and exits with one bounded frame', () => {
  const result = spawnSync('npm', ['start'], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 10000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  checkFrame(result.stdout);
  assert.equal(result.stdout, renderFrame());
});
