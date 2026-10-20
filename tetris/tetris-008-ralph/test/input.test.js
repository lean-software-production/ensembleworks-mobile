import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createInputDecoder } from '../src/input.js';
import { start } from '../src/main.js';
import { createGame } from '../src/model.js';

test('decoder handles packed/split arrows and safely consumes unknown sequences', () => {
  const actions = [];
  const feed = createInputDecoder(action => actions.push(action));
  for (const chunk of ['\x1b', '[', 'D\x1b[C\x1b[A\x1b', '[B', 'prq']) feed(Buffer.from(chunk));
  assert.deepEqual(actions, ['left', 'right', 'rotate', 'down', 'toggle-pause', 'restart', 'quit']);
  actions.length = 0;
  for (const chunk of ['xyz \n', '\x1b[12', ';q', '\x1bx', '\x1b[Z', '\x1b[999~']) feed(chunk);
  assert.deepEqual(actions, []);
});

test('ESC intermediate sequences suppress final keys packed, split and bytewise', () => {
  for (const sequence of ['\x1b(q', '\x1b#p', '\x1b r', '\x1b( #q']) {
    for (let split = 0; split <= sequence.length; split++) {
      const actions = [];
      const feed = createInputDecoder(action => actions.push(action));
      feed(sequence.slice(0, split)); feed(sequence.slice(split));
      assert.deepEqual(actions, []);
      feed('p\x1b[Dq');
      assert.deepEqual(actions, ['toggle-pause', 'left', 'quit']);
    }
    const actions = [];
    const feed = createInputDecoder(action => actions.push(action));
    for (const byte of Buffer.from(sequence)) feed(Buffer.from([byte]));
    assert.deepEqual(actions, []);
    feed('r'); assert.deepEqual(actions, ['restart']);
  }
  const actions = [];
  createInputDecoder(action => actions.push(action))('\x1b(q\x1b#p\x1b rp');
  assert.deepEqual(actions, ['toggle-pause']);
});

test('control strings suppress payload keys at every chunk boundary', () => {
  for (const sequence of ['\x1b]0;p\x07', '\x1b]rqp\x1b\\',
    '\x1bPq\x1b\\', '\x1bXprq\x1b\\', '\x1b^p\x07q\x1b\\', '\x1b_prq\x1b\\']) {
    for (let split = 0; split <= sequence.length; split++) {
      const actions = [];
      const feed = createInputDecoder(action => actions.push(action));
      feed(sequence.slice(0, split));
      feed(sequence.slice(split));
      assert.deepEqual(actions, [], `payload at split ${split}`);
      feed('p\x1b[Dq');
      assert.deepEqual(actions, ['toggle-pause', 'left', 'quit']);
    }
    const actions = [];
    const feed = createInputDecoder(action => actions.push(action));
    for (const byte of Buffer.from(sequence)) feed(Buffer.from([byte]));
    assert.deepEqual(actions, []);
    feed('r'); assert.deepEqual(actions, ['restart']);
  }
});

test('production session accepts raw bytes, freezes pause, legally stacks to restart and quits', () => {
  const input = new EventEmitter();
  Object.assign(input, { isTTY: true, isRaw: false,
    setRawMode(value) { this.isRaw = value; }, resume() {}, pause() {} });
  const frames = [];
  const output = { isTTY: true, write: text => frames.push(text) };
  const jobs = new Map(); let id = 0;
  const clock = { setTimeout(fn) { jobs.set(++id, fn); return id; }, clearTimeout(id) { jobs.delete(id); } };
  const game = createGame(() => 'T');
  const app = start({ input, output, game, clock });
  const send = text => input.emit('data', Buffer.from(text));
  assert.equal(input.isRaw, true);
  const x = game.active.x;
  send('\x1b['); assert.equal(game.active.x, x);
  send('D'); assert.equal(game.active.x, x - 1);
  send('\x1b[C'); assert.equal(game.active.x, x);
  const cells = JSON.stringify(game.active.cells);
  send('\x1b[A'); assert.notEqual(JSON.stringify(game.active.cells), cells);
  send('\x1b[B'); assert.equal(game.active.y, 1);
  send('p'); const paused = structuredClone(game);
  send('\x1b[D\x1b[A\x1b[Br'); assert.deepEqual(game, paused);
  assert.equal(jobs.size, 0);
  send('p'); assert.equal(game.status, 'running'); assert.equal(jobs.size, 1);
  const snapshot = structuredClone(game);
  send('xyz \x1b[42q'); assert.deepEqual(game, snapshot);
  for (const sequence of ['\x1b(q', '\x1b#p', '\x1b r', '\x1b( #q',
    '\x1b(q\x1b#p\x1b r', '\x1b]0;p\x07', '\x1bPq\x1b\\', '\x1b]rqp\x1b\\']) {
    for (let split = 0; split <= sequence.length; split++) {
      send(sequence.slice(0, split)); send(sequence.slice(split));
      assert.deepEqual(game, snapshot);
      assert.equal(input.listenerCount('data'), 1);
      assert.equal(input.isRaw, true);
      assert.equal(jobs.size, 1);
    }
  }
  send('p'); assert.equal(game.status, 'paused');
  send('p'); assert.equal(game.status, 'running');
  // Only legal soft drops: no board, score or status edits.
  for (let n = 0; game.status === 'running' && n < 500; n++) send('\x1b[B');
  assert.equal(game.status, 'game-over');
  send('r'); assert.equal(game.status, 'running');
  assert.equal(game.score, 0); assert.ok(game.board.flat().every(cell => !cell));
  for (const frame of frames.filter(text => text.includes('Score:'))) {
    assert.equal(frame.split('\n').length, 24);
  }
  send('q'); app.quit();
  assert.equal(input.isRaw, false); assert.equal(jobs.size, 0);
  assert.equal(input.listenerCount('data'), 0);
});
