import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { start } from '../src/index.js';

test('launch path: timed fall, lock, clear/score, blocked spawn, restart and quit', () => {
  const input = new EventEmitter();
  input.isTTY = true;
  input.isRaw = false;
  input.setRawMode = value => { input.isRaw = value; };
  input.pause = () => {};
  const output = new EventEmitter();
  output.isTTY = true;
  output.columns = 50;
  output.rows = 24;
  const frames = [];
  output.write = text => {
    if (text.startsWith('\x1b[H\x1b[2J')) {
      const lines = text.slice(7).split('\n');
      assert.equal(lines.length, 24);
      assert.ok(lines.every(line => line.length <= 50));
      frames.push(lines);
    }
  };
  const signals = new EventEmitter();
  const timers = new Map();
  let nextId = 0;
  const scheduler = {
    setInterval(fn, delay) { assert.equal(delay, 1000); const id = ++nextId; timers.set(id, fn); return id; },
    clearInterval(id) { timers.delete(id); },
  };
  const order = ['O', 'I', 'I'];
  let index = 0;
  const source = { next: () => order[index++] ?? 'O', reset: () => { index = 0; } };
  const app = start({ input, output, signals, scheduler, source });
  const key = bytes => input.emit('data', Buffer.from(bytes));
  const tick = () => { assert.equal(timers.size, 1); [...timers.values()][0](); };
  const untilNext = () => {
    const old = index;
    for (let i = 0; i < 22 && index === old; i++) tick();
    assert.equal(index, old + 1);
  };
  assert.equal(app.game.active.type, 'O');
  key('\x1b[D'.repeat(4)); // O occupies bottom columns 0–1
  tick();
  assert.equal(app.game.active.y, 1);
  untilNext();
  assert.equal(app.game.active.type, 'I');
  assert.equal(app.game.board[19][0], 'O');
  key('\x1b[D'); // I occupies columns 2–5
  untilNext();
  key('\x1b[C'.repeat(3)); // I occupies columns 6–9
  untilNext();
  assert.equal(app.game.score, 100);
  assert.equal(app.game.board[19].filter(cell => cell !== null).length, 2);
  assert.ok(frames.some(lines => lines[22] === 'Score: 100'));
  assert.equal(app.game.active.type, 'O');
  // Stack O pieces at their centered spawn until the next spawn is obstructed.
  for (let i = 0; i < 12 && app.game.status !== 'over'; i++) {
    for (let j = 0; j < 22 && app.game.status === 'running'; j++) tick();
  }
  assert.equal(app.game.status, 'over');
  assert.equal(app.game.active, null);
  assert.ok(frames.at(-1)[23].includes('Game over'));
  assert.equal(timers.size, 0);
  key('r');
  assert.equal(app.game.status, 'running');
  assert.equal(app.game.score, 0);
  assert.equal(app.game.active.type, 'O');
  assert.ok(app.game.board.every(row => row.every(cell => cell === null)));
  assert.equal(timers.size, 1);
  key('q');
  assert.equal(timers.size, 0);
  assert.equal(input.isRaw, false);
  assert.equal(input.listenerCount('data'), 0);
  assert.equal(output.listenerCount('resize'), 0);
  assert.equal(signals.listenerCount('SIGINT'), 0);
  assert.ok(frames.length > 25);
});
