import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { spawnSync } from 'node:child_process';
import { startGame } from '../src/main.js';
import { createEmptyState, createSpawnPiece, canPlace } from '../src/model.js';

const visible = text => text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');

test('production composition: fall, lock, clear/score, game over, restart, quit', () => {
  const state = createEmptyState();
  state.board[19] = Array.from({ length: 10 }, (_, x) => x >= 3 && x <= 6 ? null : 'J');
  state.board[0][4] = 'T'; // after the clear this blocks the next O at row 1
  state.active = { ...createSpawnPiece('I'), y: 17 };
  assert.ok(canPlace(state.board, state.active));
  const input = new EventEmitter();
  Object.assign(input, { isTTY: true, isRaw: false, setRawMode(v) { this.isRaw = v; }, resume() {}, pause() {} });
  const output = new EventEmitter();
  const writes = [];
  Object.assign(output, { isTTY: true, rows: 24, columns: 40, write(s) { writes.push(s); } });
  const signals = new EventEmitter();
  const timers = new Map();
  let id = 0;
  const clock = { setTimeout(fn, delay) { assert.equal(delay, 1000); timers.set(++id, fn); return id; }, clearTimeout(key) { timers.delete(key); } };
  const tick = () => { assert.equal(timers.size, 1); const [key, fn] = timers.entries().next().value; timers.delete(key); fn(); };
  const types = ['O', 'T'];
  const exits = [];
  const game = startGame({ input, output, signals, clock, state, typeSource: () => types.shift(), onExit: code => exits.push(code), diagnostics: { write(s) { assert.fail(s); } } });
  assert.equal(input.isRaw, true);
  tick();
  assert.equal(state.active.y, 18);
  assert.equal(state.score, 0);
  tick();
  assert.equal(state.score, 100);
  assert.equal(state.status, 'game-over');
  assert.equal(state.active, null);
  assert.equal(state.board[1][4], 'T');
  assert.equal(timers.size, 0);
  assert.match(visible(writes.at(-1)), /100/);
  const lost = structuredClone(state);
  input.emit('data', Buffer.from('\x1b[B\x1b[D\x1b[A'));
  assert.deepEqual(state, lost);
  input.emit('data', Buffer.from('r'));
  assert.equal(state.status, 'running');
  assert.equal(state.score, 0);
  assert.equal(state.active.type, 'T');
  assert.ok(state.board.flat().every(cell => cell === null));
  assert.equal(types.length, 0);
  assert.equal(timers.size, 1);
  input.emit('data', Buffer.from('p'));
  assert.equal(state.status, 'paused');
  assert.equal(timers.size, 0);
  input.emit('data', Buffer.from('p'));
  assert.equal(timers.size, 1);
  const frames = writes.filter(s => s.startsWith('\x1b[H\x1b[2K'));
  assert.ok(frames.length >= 7);
  for (const frame of frames) {
    const rows = visible(frame).split('\r\n');
    assert.equal(rows.length, 24);
    assert.ok(rows.every(row => row.length <= 40));
    assert.ok(!frame.endsWith('\n'));
  }
  input.emit('data', Buffer.from('q'));
  game.cleanup();
  assert.deepEqual(exits, [0]);
  assert.equal(input.isRaw, false);
  assert.equal(timers.size, 0);
  assert.equal(writes.at(-1), '\x1b[0m\x1b[?25h\x1b[?1049l');
  for (const emitter of [input, output, signals]) assert.equal(emitter.eventNames().length, 0);
});

test('actual non-TTY entry point exits successfully with a bounded frame', () => {
  const result = spawnSync(process.execPath, ['src/main.js'], { encoding: 'utf8', timeout: 3000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.ok(!result.stdout.includes('\x1b[?1049h'));
  const rows = visible(result.stdout).split('\n');
  assert.equal(rows.length, 24);
  assert.ok(rows.every(row => row.length <= 40));
});
