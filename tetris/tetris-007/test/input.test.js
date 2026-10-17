import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createInputDecoder, attachInput } from '../src/input.js';
import { createSession } from '../src/session.js';
import { createInitialState } from '../src/model.js';
import { renderFrame } from '../src/render.js';

test('ANSI/application arrows and letter bindings survive every chunk split', () => {
  const bytes = Buffer.from('\x1b[D\x1bOC\x1b[A\x1bOBpPrRqQ\x03');
  const expected = ['left', 'right', 'rotate', 'down', 'pause', 'pause', 'restart', 'restart', 'quit', 'quit', 'quit'];
  for (let split = 0; split <= bytes.length; split++) {
    const actual = []; const feed = createInputDecoder(x => actual.push(x));
    feed(bytes.subarray(0, split)); feed(bytes.subarray(split));
    assert.deepEqual(actual, expected);
  }
  const actual = []; const feed = createInputDecoder(x => actual.push(x));
  for (const byte of bytes) feed(Buffer.from([byte]));
  assert.deepEqual(actual, expected);
});

test('unknown/control payloads are ignored with bounded incomplete state', () => {
  const actual = []; const feed = createInputDecoder(x => actual.push(x));
  feed('xyz\x1b[1;5D\x1b[123q\x1b]title pqr\x07\x1bOP');
  feed('\x1b[' + '1'.repeat(100000)); feed('p');
  feed('\x1b]'); feed('q'.repeat(100000)); feed('\x1b\\');
  assert.deepEqual(actual, []);
  feed('Q'); assert.deepEqual(actual, ['quit']);
});

test('unsupported escapes and control strings never leak gameplay payloads', () => {
  const sequences = ['\x1b(q', '\x1b%p', '\x1b !r',
    '\x1bPpayload\x07qpr\x1b\\', '\x1b^\x07pqr\x1b\\',
    '\x1b_\x07qpr\x1b\\', '\x1bXpayload pqr\x1b\\',
    '\x1bXpayload\x07pqr\x1b\\', '\x1b]pqr\x07', '\x1b]pqr\x1b\\'];
  for (const sequence of sequences) {
    for (let split = 0; split <= sequence.length; split++) {
      const s = setup(); const before = structuredClone(s.state);
      s.key(sequence.slice(0, split)); s.key(sequence.slice(split));
      assert.deepEqual(s.state, before, JSON.stringify(sequence));
      assert.equal(s.quits(), 0);
      s.key('p'); assert.equal(s.state.status, 'paused');
      s.key('q'); assert.equal(s.quits(), 1);
    }
    const s = setup(); const before = structuredClone(s.state);
    for (const byte of Buffer.from(sequence)) s.key(Buffer.from([byte]));
    assert.deepEqual(s.state, before, JSON.stringify(sequence));
    assert.equal(s.quits(), 0);
    s.key('p'); assert.equal(s.state.status, 'paused');
    s.key('q'); assert.equal(s.quits(), 1);
  }
});

function setup() {
  const input = new EventEmitter();
  const state = createInitialState(() => 'T');
  const jobs = new Set(); const frames = [];
  const session = createSession({ state, typeSource: () => 'T',
    clock: { setTimeout(fn) { jobs.add(fn); return fn; }, clearTimeout(fn) { jobs.delete(fn); } },
    onChange(s) { frames.push(renderFrame(s)); } });
  let quits = 0;
  const detach = attachInput(input, session, () => quits++);
  const key = bytes => input.emit('data', Buffer.from(bytes));
  return { input, state, session, jobs, frames, key, detach, quits: () => quits };
}

test('scripted bytes move, rotate, descend, pause/resume, restart and quit', () => {
  const s = setup(); const x = s.state.active.x;
  s.key('\x1b[D'); assert.equal(s.state.active.x, x - 1);
  s.key('\x1bOC'); assert.equal(s.state.active.x, x);
  s.key('\x1b[B'); assert.equal(s.state.active.y, 1);
  const before = structuredClone(s.state.active);
  s.key('\x1b[A'); assert.notDeepEqual(s.state.active, before);
  s.key('p'); const paused = structuredClone(s.state);
  s.key('\x1b[D\x1b[A\x1b[BRxyz'); assert.deepEqual(s.state, paused);
  s.key('P'); assert.equal(s.state.status, 'running');
  s.state.status = 'game-over'; s.state.active = null; s.state.score = 800;
  s.key('r'); assert.equal(s.state.status, 'running'); assert.equal(s.state.score, 0);
  for (const frame of s.frames) {
    const rows = frame.replace(/\x1b\[[0-9;]*m/g, '').split('\n');
    assert.equal(rows.length, 24); assert.ok(rows.every(r => r.length <= 40));
  }
  s.key('q\x1b[B'); assert.equal(s.quits(), 1); assert.equal(s.jobs.size, 0);
  assert.equal(s.input.listenerCount('data'), 0);
});

test('EOF and Ctrl-C stop timers once; explicit detachment is idempotent', () => {
  for (const finish of [s => s.key('\x03'), s => s.input.emit('end')]) {
    const s = setup(); finish(s); finish(s);
    assert.equal(s.quits(), 1); assert.equal(s.jobs.size, 0);
    assert.equal(s.input.listenerCount('end'), 0); s.detach(); s.detach();
  }
});
