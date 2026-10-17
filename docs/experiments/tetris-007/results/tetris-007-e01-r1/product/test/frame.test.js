import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { formatFrame, MIN_WIDTH, TYPE_COLOURS } from '../src/frame.js';

const plain = text => text.replace(/\x1b\[[0-9;]*m/g, '');
function checkFrame(frame) {
  const rows = plain(frame).split('\n');
  assert.equal(rows.length, 24, 'includes trailing-newline effects');
  assert.ok(rows.every(row => row.length < MIN_WIDTH));
  assert.equal(rows[0], '+--------------------+');
  assert.equal(rows[21], rows[0]);
  assert.equal(rows.slice(1, 21).length, 20);
  assert.ok(rows.slice(1, 21).every(row => /^\|.{20}\|$/.test(row)));
  assert.match(rows[22], /Score:/);
  assert.match(rows[23], /Q quit/);
}

test('empty board has borders, twenty rows, score and concise controls', () => {
  const frame = formatFrame();
  checkFrame(frame);
  assert.ok(frame.split('\n').slice(1, 21).every(row => row === '|                    |'));
  assert.match(frame, /Score: 0/);
  assert.match(frame, /Arrows move\/rotate\/down \| P pause/);
  assert.ok(!frame.includes('\x1b'));
});

test('all statuses and oversized scores retain the same bounded geometry', () => {
  for (const status of ['running', 'paused', 'game-over']) {
    for (const score of [0, 999999999, 1e100, Number.MAX_VALUE]) {
      const options = { status, score };
      const unstyled = formatFrame(options);
      const styled = formatFrame({ ...options, colour: true });
      checkFrame(unstyled);
      checkFrame(styled);
      assert.equal(plain(styled), unstyled);
      assert.ok(styled.endsWith('\x1b[0m'));
    }
  }
  assert.match(formatFrame({ status: 'paused' }), /PAUSED/);
  assert.match(formatFrame({ status: 'game-over' }), /GAME OVER/);
});

test('seven type colours are distinct, readable without colour, and rendering is pure', () => {
  const grid = Array.from({ length: 20 }, () => Array(10).fill(null));
  Object.keys(TYPE_COLOURS).forEach((type, x) => { grid[0][x] = type; });
  const before = structuredClone(grid);
  const frame = formatFrame({ grid, colour: true });
  checkFrame(frame);
  assert.equal(new Set(Object.values(TYPE_COLOURS)).size, 7);
  for (const type of Object.keys(TYPE_COLOURS)) assert.ok(plain(frame).includes(type.repeat(2)));
  assert.deepEqual(grid, before);
});

test('exact npm start capture exits promptly with one unstyled 24-row snapshot', () => {
  const result = spawnSync('npm', ['start'], { encoding: 'utf8', timeout: 10000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.ok(!result.stdout.includes('\x1b'));
  checkFrame(result.stdout);
  assert.equal(result.stdout, formatFrame());
});
