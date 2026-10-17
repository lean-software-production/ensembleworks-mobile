import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createEmptyState, renderFrame } from '../src/render.js';

const visible = text => text.replace(/\x1b\[[0-9;]*m/g, '');

function checkFrame(frame) {
  const rows = visible(frame).split('\n');
  assert.equal(rows.length, 24);
  assert.ok(rows.every(row => row.length <= 40));
  assert.equal(rows[0], '+--------------------+');
  assert.equal(rows[21], rows[0]);
  assert.deepEqual(rows.slice(1, 21), Array(20).fill('| . . . . . . . . . .|'));
  assert.match(rows[22], /Score: 0/);
  assert.match(rows[23], /Arrows:.*P:pause Q:quit/);
  assert.ok(!frame.endsWith('\n'));
}

test('empty state has independent 10-column rows', () => {
  const state = createEmptyState();
  assert.equal(state.board.length, 20);
  assert.ok(state.board.every(row => row.length === 10 && row.every(cell => cell === null)));
  assert.notEqual(state.board[0], state.board[1]);
});

test('pure coloured renderer includes the entire bounded frame', () => {
  const state = createEmptyState();
  const before = structuredClone(state);
  const first = renderFrame(state);
  checkFrame(first);
  assert.equal(renderFrame(state), first);
  assert.deepEqual(state, before);
  assert.match(first, /\x1b\[36m/);
  assert.ok(first.endsWith('\x1b[0m'));
});

test('large score remains within the reserved row', () => {
  const state = createEmptyState();
  state.score = 10n ** 100n;
  const rows = visible(renderFrame(state)).split('\n');
  assert.equal(rows.length, 24);
  assert.ok(rows.every(row => row.length <= 40));
});

test('actual entry point exits successfully with capturable bounded output', () => {
  const result = spawnSync(process.execPath, ['src/main.js'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  checkFrame(result.stdout);
});
