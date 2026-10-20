import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { spawnSync } from 'node:child_process';
import { startSession, decoder } from '../src/session.js';

export function rig() {
  const input = new EventEmitter(), output = new EventEmitter(), signals = new EventEmitter();
  Object.assign(input, { isTTY: true, isRaw: false, setRawMode(v) { this.isRaw = v; }, resume() {}, pause() {} });
  const writes = [];
  Object.assign(output, { isTTY: true, columns: 40, rows: 24, write(s) { writes.push(s); } });
  let now = 0, id = 0; const jobs = new Map();
  const clock = { setTimeout(fn, delay) { jobs.set(++id, { fn, at: now + delay }); return id; }, clearTimeout(i) { jobs.delete(i); } };
  const tick = ms => { now += ms; for (const [i, job] of [...jobs]) if (job.at <= now) { jobs.delete(i); job.fn(); } };
  return { input, output, signals, clock, writes, jobs, tick };
}

test('R10/R11: clock, chunk decoder, pause, grounded progression and fresh intervals', () => {
  const r = rig(); const s = startSession({ ...r, next: () => 'O' });
  r.tick(499); assert.equal(s.state.active.y, 0); r.tick(1); assert.equal(s.state.active.y, 1);
  const x = s.state.active.x;
  r.input.emit('data', Buffer.from('\x1b[')); r.input.emit('data', Buffer.from('D\x1b[C\x1b[A'));
  assert.equal(s.state.active.x, x);
  const before = structuredClone(s.state); r.input.emit('data', Buffer.from('junk\x1b[99~')); assert.deepEqual(s.state, before);
  r.input.emit('data', Buffer.from('p')); assert.equal(r.jobs.size, 0); r.tick(5000); assert.deepEqual(s.state.active, before.active);
  r.input.emit('data', Buffer.from('p')); r.tick(499); assert.equal(s.state.active.y, 1); r.tick(1); assert.equal(s.state.active.y, 2);
  for (let i = 0; i < 17; i++) r.tick(500);
  assert.equal(s.state.active.y, 0); assert.equal(s.state.board.flat().filter(Boolean).length, 4);
  assert.equal(r.jobs.size, 1); s.cleanup(); assert.equal(r.jobs.size, 0);
  assert.equal(r.input.isRaw, false); assert.equal(r.input.listenerCount('data'), 0);
});

test('R12: redraw, resize, interruption, partial setup failure and idempotent cleanup', () => {
  for (const event of ['SIGINT', 'SIGTERM', 'SIGHUP', 'quit']) {
    const r = rig(); const s = startSession({ ...r, next: () => 'T' });
    r.output.columns = 8; r.output.rows = 1; r.output.emit('resize');
    assert.equal(r.writes.at(-1).replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').length, 7);
    r.output.columns = 40; r.output.rows = 24; r.output.emit('resize');
    assert.ok(r.writes.at(-1).startsWith('\x1b[H\x1b[2J'));
    if (event === 'quit') r.input.emit('data', Buffer.from('q')); else r.signals.emit(event);
    s.cleanup(); assert.equal(r.jobs.size, 0); assert.equal(r.input.isRaw, false);
    assert.equal(r.output.listenerCount('resize'), 0); assert.equal(r.signals.listenerCount('SIGINT'), 0);
    assert.ok(r.writes.at(-1).includes('\x1b[?25h'));
  }
  const r = rig(); r.output.write = () => { throw Error('write failure'); };
  assert.throws(() => startSession(r), /write failure/); assert.equal(r.input.isRaw, false); assert.equal(r.jobs.size, 0);
});

test('R11: decoder handles split sequences and multiple actions', () => {
  const actions = []; const feed = decoder(a => actions.push(a));
  for (const chunk of ['\x1b', '[', 'A\x1b[B\x1b[C\x1b[Dprq', '\x1b[12;', '3~']) feed(Buffer.from(chunk));
  assert.deepEqual(actions, ['rotate', 'down', 'right', 'left', 'pause', 'restart', 'quit']);
});

test('R11/R12: unknown CSI/SS3 is inert at every split; pending escapes cannot swallow Ctrl-C', () => {
  for (const sequence of ['\x1b[?1p', '\x1b[1:2q', '\x1b[1 q', '\x1b[>2r',
    '\x1bOp', '\x1bOq', '\x1bOr', '\x1bOA', '\x1bO1;2p']) {
    for (let split = 0; split <= sequence.length; split++) {
      const r = rig(); const s = startSession({ ...r, next: () => 'T' });
      const before = structuredClone(s.state), count = r.writes.length;
      r.input.emit('data', Buffer.from(sequence.slice(0, split)));
      r.input.emit('data', Buffer.from(sequence.slice(split)));
      assert.deepEqual(s.state, before);
      assert.equal(r.writes.length, count);
      assert.equal(r.input.isRaw, true);
      r.input.emit('data', Buffer.from('\x1b[D'));
      assert.equal(s.state.active.x, before.active.x - 1);
      s.cleanup();
    }
  }
  for (const prefix of ['\x1b', '\x1b[', '\x1b[?1', '\x1b[1:', '\x1b[1 ', '\x1bO', '\x1bO1;']) {
    for (const split of [false, true]) {
      const r = rig(); startSession({ ...r });
      if (split) { r.input.emit('data', Buffer.from(prefix)); r.input.emit('data', Buffer.from('\x03')); }
      else r.input.emit('data', Buffer.from(prefix + '\x03'));
      assert.equal(r.input.isRaw, false);
      assert.equal(r.jobs.size, 0);
      assert.equal(r.input.listenerCount('data'), 0);
      assert.ok(r.writes.at(-1).includes('\x1b[?25h'));
    }
  }
});

test('R13: actual production entry legal lifecycle in controlled process', () => {
  const run = spawnSync(process.execPath, ['test/support/production.mjs'], { encoding: 'utf8', timeout: 5000 });
  assert.equal(run.status, 0, run.stderr); assert.match(run.stderr, /production lifecycle passed/);
});
