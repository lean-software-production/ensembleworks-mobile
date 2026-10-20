import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { start } from '../src/main.js';
import { createGame } from '../src/model.js';

function fixture() {
  const input = Object.assign(new EventEmitter(), { isTTY: true, isRaw: false,
    isPaused: () => true, setRawMode(v) { this.isRaw = v; }, resume() {}, pause() { this.paused = true; } });
  const writes = [], errors = [], jobs = new Map(); let id = 0;
  const output = Object.assign(new EventEmitter(), { isTTY: true, columns: 63, rows: 24,
    write(text) { writes.push(text); } });
  const signals = new EventEmitter();
  const clock = { setTimeout(fn) { jobs.set(++id, fn); return id; }, clearTimeout(id) { jobs.delete(id); } };
  const app = start({ input, output, signals, clock, game: createGame(() => 'O'), onError: e => errors.push(e) });
  return { input, output, signals, jobs, writes, errors, app };
}
function restored(f) {
  assert.equal(f.input.isRaw, false);
  assert.equal(f.input.paused, true);
  assert.equal(f.jobs.size, 0);
  for (const target of [f.input, f.output, f.signals]) assert.equal(target.eventNames().length, 0);
  assert.match(f.writes.at(-1), /\x1b\[\?25h/);
  const count = f.writes.length; f.app.quit(); assert.equal(f.writes.length, count);
}
test('redraw replaces bounded frames; shrink warnings fit and resize recovers', () => {
  const f = fixture();
  f.input.emit('data', '\x1b[B');
  const frames = f.writes.filter(s => s.startsWith('\x1b[H'));
  assert.equal(frames.length, 2);
  for (const frame of frames) {
    const plain = frame.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
    assert.equal(plain.split('\n').length, 24);
    assert.ok(plain.split('\n').every(row => row.length <= 63));
    assert.ok(!plain.endsWith('\n'));
  }
  for (const [columns, rows] of [[8, 3], [60, 1], [1, 1], [0, 0]]) {
    Object.assign(f.output, { columns, rows }); f.output.emit('resize');
    const plain = f.writes.at(-1).replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
    assert.ok(plain.length <= Math.max(0, columns - 1));
    assert.ok(!plain.includes('\n'));
  }
  Object.assign(f.output, { columns: 63, rows: 24 }); f.output.emit('resize');
  assert.equal(f.writes.at(-1).split('\n').length, 24);
  f.input.emit('data', 'q'); restored(f);
});
test('signals, stream failures, input end and draw failures converge on teardown', () => {
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    const f = fixture(); f.signals.emit(signal); restored(f);
  }
  for (const target of ['input', 'output']) {
    const f = fixture(); f[target].emit('error', new Error('broken')); restored(f);
    assert.equal(f.errors.length, 1);
  }
  const f = fixture(); f.input.emit('end'); restored(f);
  const g = fixture(); const write = g.output.write;
  g.output.write = () => { throw new Error('write failed'); };
  g.output.emit('resize'); g.output.write = write;
  assert.equal(g.input.isRaw, false); assert.equal(g.jobs.size, 0);
  assert.equal(g.errors.length, 1); assert.equal(g.output.listenerCount('resize'), 0);
});
test('failure during a scheduled gameplay callback restores terminal', () => {
  const f = fixture();
  Object.defineProperty(f.app.game, 'status', { get() { throw new Error('tick failed'); } });
  const tick = [...f.jobs.values()][0]; f.jobs.clear(); tick(); restored(f); assert.equal(f.errors.length, 1);
});
