import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { renderFrame } from '../src/render.js';
import { main } from '../src/main.js';

const plain = text => text.replace(/\x1b\[[0-9;]*m/g, '');
const snapshot = () => ({ board: Array.from({ length: 20 }, () => Array(10).fill(null)), score: 0, phase: 'running' });
function bounded(frame) {
  const lines = plain(frame).split('\n');
  assert.equal(lines.length, 24);
  assert.ok(lines.every(line => line.length <= 64));
  assert.ok(!frame.endsWith('\n'));
  assert.equal(lines[0], '+--------------------+');
  assert.equal(lines[21], lines[0]);
  assert.equal(lines.slice(1, 21).length, 20);
  assert.ok(lines.slice(1, 21).every(line => /^\|.{20}\|$/.test(line)));
  assert.match(lines[22], /Score:/);
  for (const control of ['Left/Right', 'Up', 'Down', 'P:', 'R:', 'Q:']) assert.ok(lines[23].includes(control));
}

test('pure renderer fits all display phases, colors and large scores', () => {
  for (const phase of ['running', 'paused', 'game-over']) {
    for (const color of [false, true]) {
      const state = snapshot();
      state.phase = phase;
      state.score = Number.MAX_VALUE;
      state.board[0].splice(0, 7, ...'IOTJLSZ');
      const before = structuredClone(state);
      const frame = renderFrame(state, { color });
      bounded(frame);
      assert.deepEqual(state, before);
      if (color) {
        for (const code of [96, 93, 95, 94, 91, 92, 31]) assert.ok(frame.includes(`\x1b[${code}m`));
        assert.ok(frame.endsWith('\x1b[0m'));
      } else assert.ok(!frame.includes('\x1b'));
    }
  }
});

test('non-TTY entry writes one plain frame without touching input', () => {
  const writes = [];
  main({ input: { isTTY: false }, output: { isTTY: false, write: value => writes.push(value) } });
  assert.equal(writes.length, 1);
  bounded(writes[0]);
  assert.ok(!writes[0].includes('\x1b'));
});

test('small TTY warning fits available space', () => {
  for (const [columns, rows] of [[64, 24], [65, 23], [5, 1], [0, 0]]) {
    let text = '';
    main({ input: { isTTY: true }, output: { isTTY: true, columns, rows, write: value => { text += value; } } });
    assert.ok(text.length <= Math.max(0, columns - 1));
    assert.ok(!text.includes('\n'));
    if (rows === 0) assert.equal(text, '');
  }
});

test('actual entry and silent npm launch capture bounded frames and exit', () => {
  for (const [command, args] of [['node', ['src/main.js']], ['npm', ['--silent', 'start']]]) {
    const result = spawnSync(command, args, { encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    bounded(result.stdout);
  }
});
