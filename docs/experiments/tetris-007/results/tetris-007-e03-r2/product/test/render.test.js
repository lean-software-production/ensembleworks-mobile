import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { emptyBoard, renderFrame, measureFrame, stripAnsi, PIECE_COLOURS } from '../src/render.js';

test('empty board has exactly 20 rows, borders and two status rows', () => {
  const frame = renderFrame({ board: emptyBoard() });
  const lines = frame.split('\n');
  assert.equal(lines.length, 24);
  assert.equal(lines[0], '+--------------------+');
  assert.deepEqual(lines.slice(1, 21), Array(20).fill('|                    |'));
  assert.equal(lines[21], lines[0]);
  assert.match(lines[22], /Score: 0 \| Running/);
  assert.match(lines[23], /Arrows:.*P:pause.*R:restart.*Q:quit/);
  assert.ok(!frame.includes('\x1b'));
  assert.deepEqual(measureFrame(frame + '\n'), { rows: 25, columns: 52 });
});

test('all phases and huge scores stay bounded; colour and plain agree without mutation', () => {
  const board = emptyBoard();
  Object.keys(PIECE_COLOURS).forEach((type, x) => { board[19][x] = type; });
  assert.equal(new Set(Object.values(PIECE_COLOURS)).size, 7);
  for (const phase of ['running', 'paused', 'game over']) {
    const snapshot = { board, active: { type: 'T', cells: [{ x: 4, y: 0 }] }, score: 10n ** 100n, phase };
    const before = structuredClone(snapshot);
    const plain = renderFrame(snapshot);
    const ansi = renderFrame(snapshot, { colour: true });
    assert.equal(stripAnsi(ansi), plain);
    assert.ok(ansi.endsWith('\x1b[0m'));
    for (const code of Object.values(PIECE_COLOURS)) assert.ok(ansi.includes(`\x1b[${code}m`));
    assert.equal(measureFrame(ansi).rows, 24);
    assert.ok(measureFrame(ansi).columns <= 60);
    assert.deepEqual(snapshot, before);
  }
});

test('actual entry point emits one bounded plain snapshot and exits', () => {
  const child = spawnSync(process.execPath, ['src/main.js'], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stderr, '');
  assert.equal(child.stdout, renderFrame({ board: emptyBoard() }));
  assert.equal(measureFrame(child.stdout).rows, 24);
});
