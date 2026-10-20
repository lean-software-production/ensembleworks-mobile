import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { start } from '../src/main.js';
import { createGame } from '../src/model.js';
import { PALETTE } from '../src/render.js';

test('production entry point: legal fall, lock, clear, score, game over, restart, quit', () => {
  const input = Object.assign(new EventEmitter(), { isTTY: true, isRaw: false,
    setRawMode(value) { this.isRaw = value; }, resume() {}, pause() { this.paused = true; } });
  const frames = [], jobs = new Map(); let id = 0;
  const output = Object.assign(new EventEmitter(), { isTTY: true, columns: 80, rows: 24,
    write(text) { frames.push(text); } });
  const clock = { setTimeout(fn) { jobs.set(++id, fn); return id; }, clearTimeout(key) { jobs.delete(key); } };
  // Five O pieces tile two rows. Subsequent centered O pieces stack to top-out.
  // This source is the only fixture: no board/score/status/geometry mutations.
  const game = createGame(() => 'O');
  const app = start({ input, output, clock, signals: new EventEmitter(), game,
    onError(error) { throw error; } });
  const key = text => input.emit('data', text);
  const tick = () => { const [key, fn] = jobs.entries().next().value; jobs.delete(key); fn(); };
  tick(); assert.equal(game.active.y, 1); assert.equal(game.board.flat().filter(Boolean).length, 0);
  key('p'); assert.equal(game.status, 'paused'); assert.equal(jobs.size, 0);
  key('p'); assert.equal(game.status, 'running');
  const down = '\x1b[B';
  for (const target of [0, 2, 4, 6, 8]) {
    const delta = target - game.active.x;
    key((delta < 0 ? '\x1b[D' : '\x1b[C').repeat(Math.abs(delta)));
    // Stop exactly at the lock, without descending the next piece.
    while (game.active.y < 18) key(down);
    key(down);
    if (target === 0) assert.equal(game.board.flat().filter(Boolean).length, 4);
  }
  assert.equal(game.score, 300); assert.equal(game.board.flat().filter(Boolean).length, 0);
  for (let n = 0; n < 250 && game.status === 'running'; n++) key(down);
  assert.equal(game.status, 'game-over'); assert.equal(game.active, null); assert.equal(jobs.size, 0);
  key('r'); assert.equal(game.status, 'running'); assert.equal(game.score, 0);
  assert.equal(game.board.flat().filter(Boolean).length, 0); assert.equal(game.active.y, 0);
  key('q'); assert.equal(input.isRaw, false); assert.equal(input.paused, true); assert.equal(jobs.size, 0);
  assert.equal(input.listenerCount('data'), 0);
  assert.match(frames.at(-1), /\x1b\[\?25h/);
  const plainFrames = frames.filter(text => text.startsWith('\x1b[H')).map(text => text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, ''));
  for (const frame of plainFrames) {
    assert.equal(frame.split('\n').length, 24);
    assert.ok(frame.split('\n').every(row => row.length <= 80));
    assert.ok(!frame.endsWith('\n'));
  }
  for (const label of ['Score: 300', 'Paused', 'Game over', 'r restart']) assert.ok(plainFrames.some(frame => frame.includes(label)));
  app.quit();
});

test('production terminal composition presents every retro piece colour', () => {
  for (const [type, code] of Object.entries(PALETTE)) {
    const input = Object.assign(new EventEmitter(), { isTTY: true, setRawMode() {}, resume() {}, pause() {} });
    const writes = [];
    const output = Object.assign(new EventEmitter(), { isTTY: true, columns: 80, rows: 24, write(text) { writes.push(text); } });
    const app = start({ input, output, game: createGame(() => type), signals: new EventEmitter(),
      clock: { setTimeout() { return 1; }, clearTimeout() {} } });
    assert.ok(writes.some(text => text.includes(`\x1b[${code}m[]\x1b[0m`)));
    input.emit('data', 'q'); app.quit();
  }
});
