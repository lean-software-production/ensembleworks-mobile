import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { start } from '../src/index.js';
import { createKeyDecoder } from '../src/input.js';

function session(types = ['T', 'O']) {
  const input = new EventEmitter();
  input.isTTY = true;
  input.isRaw = false;
  input.setRawMode = value => { input.isRaw = value; };
  const frames = [];
  const output = { isTTY: true, write: text => frames.push(text) };
  const timers = new Map();
  let id = 0;
  const scheduler = { setInterval: fn => { timers.set(++id, fn); return id; }, clearInterval: key => timers.delete(key) };
  let n = 0;
  const source = { next: () => types[n++ % types.length], reset: () => { n = 0; } };
  const app = start({ input, output, scheduler, source });
  const send = bytes => input.emit('data', Buffer.from(bytes));
  return { app, input, frames, timers, send };
}

test('decoder retains split arrows, handles batches and ignores unknown keys', () => {
  const keys = [];
  const decode = createKeyDecoder(key => keys.push(key));
  decode(Buffer.from('\x1b['));
  decode(Buffer.from('D\x1b[C?\x1b[A\x03'));
  assert.deepEqual(keys, ['left', 'right', 'up', 'quit']);
});

test('unsupported CSI is consumed as a unit and pending CSI cannot hide Ctrl-C', () => {
  const keys = [];
  const decode = createKeyDecoder(key => keys.push(key));
  decode(Buffer.from('\x1b[1;2'));
  decode(Buffer.from('p\x1b[1;2q\x1b[D'));
  assert.deepEqual(keys, ['left']);
  decode(Buffer.from('\x1b['));
  decode(Buffer.from('\x03'));
  assert.deepEqual(keys, ['left', 'quit']);
  decode(Buffer.from('\x1bO'));
  decode(Buffer.from('\x03'));
  assert.deepEqual(keys, ['left', 'quit', 'quit']);
});

test('unsupported CSI and SS3 cannot pause or quit a session; interrupted prefix exits', () => {
  const s = session();
  s.send('\x1b[1;2p\x1b[1;2q\x1bO');
  s.send('q\x1bOp');
  assert.equal(s.app.game.status, 'running');
  assert.equal(s.timers.size, 1);
  s.send('\x1b[');
  s.send('\x03');
  assert.equal(s.input.isRaw, false);
  assert.equal(s.input.listenerCount('data'), 0);
  assert.equal(s.timers.size, 0);
});

test('interactive input moves, rotates, drops and obeys state-specific controls', () => {
  const s = session();
  const initial = s.app.game.active;
  s.send('\x1b[D');
  assert.equal(s.app.game.active.x, initial.x - 1);
  s.send('\x1b[C');
  assert.equal(s.app.game.active.x, initial.x);
  s.send('\x1b[A\x1b[B');
  assert.equal(s.app.game.active.y, 1);
  assert.notDeepEqual(s.app.game.active.cells, initial.cells);
  const before = s.app.game;
  s.send('r?');
  assert.strictEqual(s.app.game, before);
  s.send('p');
  assert.equal(s.app.game.status, 'paused');
  assert.equal(s.timers.size, 0);
  const paused = s.app.game;
  s.send('r\x1b[B\x1b[C\x1b[A');
  assert.strictEqual(s.app.game, paused);
  assert.equal(s.timers.size, 0);
  s.send('p');
  assert.equal(s.app.game.status, 'running');
  assert.equal(s.app.game.active.y, 1);
  assert.equal(s.timers.size, 1);
  s.send('p');
  s.send('q');
  assert.equal(s.input.isRaw, false);
  assert.equal(s.input.listenerCount('data'), 0);
  assert.equal(s.timers.size, 0);
  assert.ok(s.frames.some(frame => frame.includes('Paused')));
  assert.ok(s.frames.every(frame => frame.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').split('\n').length <= 24));
});

test('quit while running stops the session and ignores later keys in the same chunk', () => {
  const s = session();
  const before = s.app.game;
  s.send('q\x1b[Bp');
  assert.strictEqual(s.app.game, before);
  assert.equal(s.input.isRaw, false);
  assert.equal(s.input.listenerCount('data'), 0);
  assert.equal(s.timers.size, 0);
});

test('game over ignores pause; restart resets; raw Ctrl-C exits', () => {
  const s = session(['O']);
  // 19 steps to floor, then a blocked downward action locks. Repeat until spawn is blocked.
  for (let i = 0; i < 120 && s.app.game.status !== 'over'; i++) s.send('\x1b[B');
  assert.equal(s.app.game.status, 'over');
  const over = s.app.game;
  s.send('p\x1b[D\x1b[A\x1b[B');
  assert.strictEqual(s.app.game, over);
  s.send('r');
  assert.equal(s.app.game.status, 'running');
  assert.equal(s.app.game.score, 0);
  assert.equal(s.timers.size, 1);
  s.send('\x03');
  assert.equal(s.input.isRaw, false);
  assert.equal(s.timers.size, 0);
  assert.equal(s.input.listenerCount('data'), 0);
});
