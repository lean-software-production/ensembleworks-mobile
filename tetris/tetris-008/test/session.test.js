import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { start } from '../src/index.js';

function fixture(columns = 50, rows = 24) {
  const input = new EventEmitter();
  input.isTTY = true;
  input.isRaw = false;
  input.setRawMode = value => { input.isRaw = value; };
  input.pause = () => {};
  const output = new EventEmitter();
  output.isTTY = true;
  output.columns = columns;
  output.rows = rows;
  output.writes = [];
  output.write = text => output.writes.push(text);
  const signals = new EventEmitter();
  const timers = new Map();
  let id = 0;
  const scheduler = { setInterval: fn => { timers.set(++id, fn); return id; }, clearInterval: key => timers.delete(key) };
  const app = start({ input, output, signals, scheduler, seed: 4 });
  const frame = () => output.writes.filter(x => x.startsWith('\x1b[H')).at(-1);
  return { input, output, signals, timers, app, frame };
}

for (const exit of ['q', '\x03', 'SIGINT', 'SIGTERM', 'error']) {
  test(`teardown on ${JSON.stringify(exit)} is idempotent`, () => {
    const s = fixture();
    assert.equal(s.input.isRaw, true);
    if (exit === 'error') s.input.emit('error', new Error('input failed'));
    else if (exit.startsWith('SIG')) s.signals.emit(exit);
    else s.input.emit('data', Buffer.from(exit));
    s.app.close();
    assert.equal(s.input.isRaw, false);
    assert.equal(s.timers.size, 0);
    assert.equal(s.input.listenerCount('data'), 0);
    assert.equal(s.input.listenerCount('error'), 0);
    assert.equal(s.output.listenerCount('resize'), 0);
    assert.equal(s.signals.listenerCount('SIGINT'), 0);
    assert.equal(s.signals.listenerCount('SIGTERM'), 0);
    assert.equal(s.output.writes.filter(x => x === '\x1b[?25h').length, 1);
  });
}

test('redraw replaces prior frames and resizing restores bounded current game', () => {
  const s = fixture();
  s.input.emit('data', Buffer.from('\x1b[B'));
  assert.ok(s.output.writes.filter(x => x.startsWith('\x1b[H\x1b[2J')).length >= 2);
  for (const [columns, rows] of [[12, 24], [50, 3], [0, 0]]) {
    s.output.columns = columns;
    s.output.rows = rows;
    s.output.emit('resize');
    const text = s.frame().slice('\x1b[H\x1b[2J'.length);
    assert.ok(text.split('\n').length <= rows || rows === 0 && text === '');
    assert.ok(text.split('\n').every(line => line.length <= columns));
    assert.ok(!text.includes('+--------------------+'));
  }
  s.output.columns = 50;
  s.output.rows = 24;
  s.output.emit('resize');
  const restored = s.frame().slice('\x1b[H\x1b[2J'.length).split('\n');
  assert.equal(restored.length, 24);
  assert.ok(restored.every(line => line.length <= 50));
  assert.ok(restored.some(line => line.includes('<>')));
  s.app.close();
});

test('failed initial draw still releases raw mode and listeners', () => {
  const input = new EventEmitter();
  input.isTTY = true;
  input.isRaw = false;
  input.setRawMode = value => { input.isRaw = value; };
  const output = new EventEmitter();
  output.isTTY = true;
  output.columns = 50;
  output.rows = 24;
  output.write = text => { if (text.startsWith('\x1b[H')) throw Error('write failed'); };
  const signals = new EventEmitter();
  assert.throws(() => start({ input, output, signals, seed: 1 }), /write failed/);
  assert.equal(input.isRaw, false);
  assert.equal(input.listenerCount('data'), 0);
  assert.equal(output.listenerCount('resize'), 0);
  assert.equal(signals.listenerCount('SIGINT'), 0);
});

test('redraw failures from input, timer and resize tear down the session', () => {
  for (const trigger of ['input', 'timer', 'resize']) {
    const s = fixture();
    s.output.write = text => {
      if (text.startsWith('\x1b[H')) throw Error('redraw failed');
      s.output.writes.push(text);
    };
    assert.throws(() => {
      if (trigger === 'input') s.input.emit('data', Buffer.from('\x1b[D'));
      if (trigger === 'timer') [...s.timers.values()][0]();
      if (trigger === 'resize') s.output.emit('resize');
    }, /redraw failed/);
    assert.equal(s.input.isRaw, false);
    assert.equal(s.timers.size, 0);
    assert.equal(s.input.listenerCount('data'), 0);
    assert.equal(s.output.listenerCount('resize'), 0);
    assert.equal(s.signals.listenerCount('SIGINT'), 0);
    assert.equal(s.output.writes.at(-1), '\x1b[?25h');
    s.app.close();
  }
});

test('preserves preexisting raw mode and restores partial raw-mode startup failure', () => {
  for (const throws of [false, true]) {
    const input = new EventEmitter();
    input.isTTY = true;
    input.isRaw = !throws;
    const original = input.isRaw;
    input.setRawMode = value => {
      input.isRaw = value;
      if (throws && value) throw Error('raw failed');
    };
    const output = new EventEmitter();
    output.isTTY = true;
    output.columns = 50;
    output.rows = 24;
    output.writes = [];
    output.write = text => output.writes.push(text);
    const signals = new EventEmitter();
    if (throws) assert.throws(() => start({ input, output, signals }), /raw failed/);
    else start({ input, output, signals }).close();
    assert.equal(input.isRaw, original);
    assert.equal(input.listenerCount('data'), 0);
    assert.equal(output.listenerCount('resize'), 0);
    assert.equal(signals.listenerCount('SIGINT'), 0);
    assert.equal(output.writes.at(-1), '\x1b[?25h');
  }
});

test('synchronous quit during resume does not start gravity after cleanup', () => {
  const input = new EventEmitter();
  input.isTTY = true;
  input.isRaw = false;
  input.setRawMode = value => { input.isRaw = value; };
  input.resume = () => input.emit('data', Buffer.from('q'));
  input.pause = () => {};
  const output = new EventEmitter();
  output.isTTY = true;
  output.columns = 50;
  output.rows = 24;
  const writes = [];
  output.write = text => writes.push(text);
  const signals = new EventEmitter();
  let starts = 0;
  const app = start({ input, output, signals, scheduler: { setInterval() { starts++; return 1; }, clearInterval() {} } });
  assert.equal(starts, 0);
  assert.equal(input.isRaw, false);
  assert.equal(input.listenerCount('data'), 0);
  assert.equal(output.listenerCount('resize'), 0);
  assert.equal(signals.listenerCount('SIGINT'), 0);
  assert.deepEqual(writes, ['\x1b[?25l', '\x1b[?25h']);
  app.close();
});

test('synchronous error during cursor hide aborts the rest of startup', () => {
  const input = new EventEmitter();
  input.isTTY = true;
  input.isRaw = false;
  let rawCalls = 0;
  input.setRawMode = () => { rawCalls++; };
  input.pause = () => {};
  const output = new EventEmitter();
  output.isTTY = true;
  output.columns = 50;
  output.rows = 24;
  const writes = [];
  output.write = text => {
    writes.push(text);
    if (text === '\x1b[?25l') output.emit('error', Error('output failed'));
  };
  const signals = new EventEmitter();
  let starts = 0;
  const app = start({ input, output, signals, scheduler: { setInterval() { starts++; return 1; }, clearInterval() {} } });
  assert.equal(starts, 0);
  assert.equal(rawCalls, 0);
  assert.equal(input.listenerCount('data'), 0);
  assert.equal(input.listenerCount('error'), 0);
  assert.equal(output.listenerCount('error'), 0);
  assert.equal(output.listenerCount('resize'), 0);
  assert.equal(signals.listenerCount('SIGINT'), 0);
  assert.deepEqual(writes, ['\x1b[?25l', '\x1b[?25h']);
  app.close();
});

test('redirected input with small TTY output emits only a bounded diagnostic', () => {
  for (const [columns, rows] of [[12, 3], [50, 2], [0, 0]]) {
    const input = new EventEmitter();
    input.isTTY = false;
    const output = { isTTY: true, columns, rows, writes: [], write(text) { this.writes.push(text); } };
    start({ input, output, scheduler: { setInterval() { throw Error('timer started'); } } });
    const text = output.writes.join('');
    assert.ok(text.split('\n').length <= Math.max(1, rows));
    assert.ok(text.split('\n').every(line => line.length <= columns));
    assert.ok(!text.includes('+--------------------+'));
    assert.ok(!text.includes('\x1b'));
    assert.equal(input.listenerCount('data'), 0);
  }
});

test('non-TTY capture does not start timers or attach listeners', () => {
  const input = new EventEmitter();
  const output = { isTTY: false, writes: [], write(text) { this.writes.push(text); } };
  start({ input, output, scheduler: { setInterval() { throw Error('timer started'); } }, seed: 2 });
  assert.equal(output.writes.length, 1);
  assert.equal(output.writes[0].split('\n').length, 24);
  assert.equal(input.listenerCount('data'), 0);
});
