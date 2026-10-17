import test from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { renderFrame } from '../src/render.js';
import { EventEmitter } from 'node:events';
import { startTerminal } from '../src/terminal.js';

function setup({ rows = 24, columns = 40, tty = true, raw = false } = {}) {
  const input = new EventEmitter();
  Object.assign(input, { isTTY: tty, isRaw: raw, setRawMode(value) { this.isRaw = value; }, resume() {}, pause() { this.paused = true; } });
  const output = new EventEmitter();
  const writes = [];
  Object.assign(output, { isTTY: tty, rows, columns, write(text) { writes.push(text); } });
  const signals = new EventEmitter();
  const timers = new Map();
  let id = 0;
  const clock = { setTimeout(fn) { const key = ++id; timers.set(key, () => { timers.delete(key); fn(); }); return key; }, clearTimeout(key) { timers.delete(key); } };
  const exits = [], errors = [];
  const terminal = startTerminal({ input, output, signals, clock, typeSource: () => 'T', onExit: code => exits.push(code), diagnostics: { write: s => errors.push(s) } });
  return { input, output, signals, timers, writes, exits, errors, terminal };
}
const visible = s => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');

test('redraw stays in place; quit restores all owned terminal state exactly once', () => {
  const f = setup();
  assert.equal(f.input.isRaw, true);
  assert.ok(f.writes[0].includes('\x1b[?1049h'));
  f.input.emit('data', Buffer.from('\x1b[D\x1b[B'));
  for (const frame of f.writes.slice(1)) {
    assert.ok(frame.startsWith('\x1b[H'));
    const lines = visible(frame).split('\r\n');
    assert.equal(lines.length, 24);
    assert.ok(lines.every(line => line.length <= 40));
    assert.ok(!frame.endsWith('\n'));
  }
  f.input.emit('data', Buffer.from('q'));
  f.terminal.cleanup();
  assert.equal(f.input.isRaw, false);
  assert.equal(f.input.paused, true);
  assert.equal(f.timers.size, 0);
  assert.deepEqual(f.exits, [0]);
  assert.equal(f.writes.at(-1), '\x1b[0m\x1b[?25h\x1b[?1049l');
  for (const emitter of [f.input, f.output, f.signals]) assert.equal(emitter.eventNames().length, 0);
});

for (const event of ['SIGINT', 'SIGTERM', 'SIGHUP', 'EOF', 'Ctrl-C']) {
  test(`${event} cleans up and preserves preexisting raw mode`, () => {
    const f = setup({ raw: true });
    if (event === 'EOF') f.input.emit('end');
    else if (event === 'Ctrl-C') f.input.emit('data', Buffer.from([3]));
    else f.signals.emit(event);
    assert.equal(f.input.isRaw, true);
    assert.equal(f.timers.size, 0);
    assert.deepEqual(f.exits, [0]);
  });
}

test('resize clears stale board, clips warning, suspends and recovers with fresh timer', () => {
  const f = setup();
  const state = structuredClone(f.terminal.session.state);
  const stale = [...f.timers.values()][0];
  Object.assign(f.output, { rows: 10, columns: 30 });
  f.output.emit('resize');
  assert.equal(f.writes.at(-2), '\x1b[2J\x1b[H');
  assert.equal(visible(f.writes.at(-1)), 'Terminal needs 40x24');
  assert.equal(f.timers.size, 0);
  stale();
  f.input.emit('data', Buffer.from('\x1b[B'));
  assert.deepEqual(f.terminal.session.state, state);
  for (const size of [{ rows: 1, columns: 3 }, { rows: 0, columns: 0 }, { rows: undefined, columns: undefined }]) {
    Object.assign(f.output, size);
    const before = f.writes.length;
    f.output.emit('resize');
    const content = visible(f.writes.slice(before).join(''));
    assert.ok(content.length <= (size.columns || 0));
  }
  Object.assign(f.output, { rows: 24, columns: 40 });
  f.output.emit('resize');
  assert.equal(f.timers.size, 1);
  assert.equal(visible(f.writes.at(-1)).split('\r\n').length, 24);
  f.input.emit('data', Buffer.from('p'));
  Object.assign(f.output, { rows: 10 }); f.output.emit('resize');
  Object.assign(f.output, { rows: 24 }); f.output.emit('resize');
  assert.equal(f.terminal.session.state.status, 'paused');
  assert.equal(f.timers.size, 0);
  f.terminal.cleanup();
});

test('undersize startup and non-TTY startup do not run gravity', () => {
  for (const options of [{ rows: 5, columns: 8 }, { tty: false }]) {
    const f = setup(options);
    assert.equal(f.timers.size, 0);
    if (options.tty === false) {
      assert.deepEqual(f.exits, [0]);
      assert.equal(f.input.isRaw, false);
      assert.equal(visible(f.writes.join('')).split('\n').length, 24);
      assert.ok(!f.writes.join('').includes('\x1b[?1049h'));
    } else assert.equal(visible(f.writes.at(-1)), 'Terminal');
    f.terminal.cleanup();
  }
});

test('handled failure after setup cleans up, reports failure, and never recursively redraws', () => {
  const f = setup();
  let attempts = 0;
  f.output.write = () => { attempts++; throw new Error('broken output'); };
  f.input.emit('data', Buffer.from('\x1b[D'));
  assert.equal(attempts, 2); // failed draw plus best-effort terminal restoration
  assert.equal(f.input.isRaw, false);
  assert.equal(f.timers.size, 0);
  assert.deepEqual(f.exits, [1]);
  assert.match(f.errors[0], /broken output/);
  f.terminal.cleanup();
  assert.equal(attempts, 2);
});

test('timer failures and stream errors use the same cleanup path', () => {
  for (const kind of ['timer', 'stream']) {
    const f = setup();
    if (kind === 'stream') f.output.emit('error', new Error('stream failed'));
    else {
      f.output.write = () => { throw new Error('timer output'); };
      [...f.timers.values()][0]();
    }
    assert.deepEqual(f.exits, [1]);
    assert.equal(f.input.isRaw, false);
    assert.equal(f.timers.size, 0);
  }
});

// Model the owned screen, including erase-line (not just ANSI stripping).
test('shorter pause and game-over rows erase previous screen contents', () => {
  const f = setup();
  const screen = Array.from({ length: 24 }, () => '');
  function apply(frame) {
    let row = 0, col = 0;
    for (const token of frame.match(/\x1b\[[0-9;?]*[A-Za-z]|\r|\n|[^\x1b\r\n]/g)) {
      if (token === '\x1b[H') { row = 0; col = 0; }
      else if (token === '\x1b[2K') screen[row] = '';
      else if (token.startsWith('\x1b')) continue;
      else if (token === '\r') col = 0;
      else if (token === '\n') row++;
      else { screen[row] = screen[row].padEnd(col, ' ').slice(0, col) + token + screen[row].slice(col + 1); col++; }
    }
  }
  apply(f.writes.at(-1));
  f.input.emit('data', Buffer.from('p'));
  apply(f.writes.at(-1));
  assert.deepEqual(screen, visible(renderFrame(f.terminal.session.state)).split('\n'));
  f.terminal.session.state.status = 'game-over';
  f.terminal.session.dispatch('left');
  apply(f.writes.at(-1));
  assert.deepEqual(screen, visible(renderFrame(f.terminal.session.state)).split('\n'));
  f.terminal.cleanup();
});

test('restoration error handler survives a controlled asynchronous destroy', async () => {
  const input = new EventEmitter();
  Object.assign(input, { isTTY: true, isRaw: false, setRawMode(v) { this.isRaw = v; }, resume() {}, pause() {} });
  let finishDestroy;
  const output = new Writable({
    write(text, encoding, callback) {
      callback(text.toString().includes('1049l') ? new Error('restoration failed') : null);
    },
    destroy(error, callback) { finishDestroy = () => callback(error); },
  });
  Object.assign(output, { isTTY: true, rows: 24, columns: 40 });
  const errors = [], exits = [];
  const terminal = startTerminal({ input, output, signals: new EventEmitter(),
    diagnostics: { write: text => errors.push(text) }, onExit: code => exits.push(code) });
  terminal.cleanup();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(typeof finishDestroy, 'function');
  assert.equal(output.destroyed, true);
  assert.equal(output.closed, false);
  assert.equal(output.listenerCount('error'), 1);
  assert.deepEqual(exits, []);
  assert.equal(input.isRaw, false);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /restoration failed/);
  finishDestroy();
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(exits, [1]);
  assert.equal(errors.length, 1);
  assert.equal(output.listenerCount('error'), 0);
  assert.equal(output.listenerCount('close'), 0);
  terminal.cleanup();
  assert.deepEqual(exits, [1]);
});

for (const failure of ['restore', 'pending']) {
  test(`asynchronous Writable ${failure} failure is diagnosed before exit`, async () => {
    const input = new EventEmitter();
    Object.assign(input, { isTTY: true, isRaw: false, setRawMode(v) { this.isRaw = v; }, resume() {}, pause() {} });
    let count = 0;
    const output = new Writable({ write(text, encoding, callback) {
      count++;
      const bad = failure === 'restore' ? text.toString().includes('1049l') : count === 2;
      setImmediate(() => callback(bad ? new Error(`${failure} failed`) : null));
    } });
    Object.assign(output, { isTTY: true, rows: 24, columns: 40 });
    const errors = [], exits = [];
    const terminal = startTerminal({ input, output, signals: new EventEmitter(), diagnostics: { write: text => errors.push(text) }, onExit: code => exits.push(code) });
    terminal.cleanup();
    assert.deepEqual(exits, []);
    for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(exits, [1]);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /failed/);
    assert.equal(input.isRaw, false);
    assert.equal(output.listenerCount('error'), 0);
    terminal.cleanup();
    assert.deepEqual(exits, [1]);
  });
}
