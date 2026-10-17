import test from 'node:test';
import strictAssert from 'node:assert/strict';
// Spawn frame origins can be -0; position checks compare numeric coordinates.
const assert = Object.assign({}, strictAssert, {
  equal(actual, expected) { strictAssert.equal(actual === 0 ? 0 : actual, expected); },
});
import { createInitialState } from '../src/model.js';
import { createSession } from '../src/session.js';
import { renderFrame } from '../src/render.js';

function fakeClock() {
  let now = 0, id = 0;
  const jobs = new Map();
  const history = [];
  return {
    jobs, history,
    setTimeout(fn, delay) { history.push(fn); jobs.set(++id, { fn, at: now + delay }); return id; },
    clearTimeout(key) { jobs.delete(key); },
    advance(ms) {
      now += ms;
      for (const [key, job] of [...jobs]) {
        if (job.at <= now) { jobs.delete(key); job.fn(); }
      }
    },
  };
}
function setup() {
  const clock = fakeClock();
  let consumed = 0;
  const source = () => { consumed++; return 'O'; };
  const state = createInitialState(source);
  const events = [];
  const session = createSession({ state, typeSource: source, clock,
    onChange: (_, event) => events.push(event) });
  return { clock, state, session, events, consumed: () => consumed };
}

test('gravity waits a full interval, moves once per tick, and never replays late ticks', () => {
  const { clock, state, events } = setup();
  clock.advance(999); assert.equal(state.active.y, 0);
  clock.advance(1); assert.equal(state.active.y, 1);
  clock.advance(5000); assert.equal(state.active.y, 2);
  assert.equal(events.length, 2);
  assert.equal(clock.jobs.size, 1);
});

test('grounded tick locks exactly once and spawns without stepping the new piece', () => {
  const { clock, state, consumed, events } = setup();
  state.active.y = 18;
  clock.advance(1000);
  assert.equal(events[0].locked, true);
  assert.equal(state.active.y, 0);
  assert.equal(consumed(), 2);
  assert.equal(state.board.flat().filter(Boolean).length, 4);
  assert.equal(clock.jobs.size, 1);
});

test('manual lock at 999 invalidates even a retained stale callback', () => {
  const { clock, state, session, events } = setup();
  const stale = clock.history[0];
  clock.advance(999);
  state.active.y = 18;
  assert.equal(session.dispatch('down').locked, true);
  stale();
  clock.advance(1); assert.equal(state.active.y, 0);
  clock.advance(998); assert.equal(state.active.y, 0);
  clock.advance(1); assert.equal(state.active.y, 1);
  assert.equal(events.length, 2);
  assert.equal(clock.jobs.size, 1);
});

test('ordinary manual actions preserve the existing deadline', () => {
  const { clock, state, session } = setup();
  clock.advance(999);
  for (const action of ['left', 'right', 'rotate', 'down', 'restart']) session.dispatch(action);
  assert.equal(state.active.y, 1);
  clock.advance(1); assert.equal(state.active.y, 2);
});

test('pause freezes every gameplay action, resume starts fresh without duplicate timers', () => {
  const { clock, state, session, consumed } = setup();
  clock.advance(999);
  const stale = clock.history[0];
  session.dispatch('pause');
  const snapshot = structuredClone(state);
  for (const action of ['left', 'right', 'rotate', 'down', 'restart']) session.dispatch(action);
  stale(); clock.advance(100000);
  assert.deepEqual(state, snapshot);
  assert.equal(consumed(), 1);
  assert.equal(clock.jobs.size, 0);
  session.dispatch('pause');
  clock.advance(999); assert.equal(state.active.y, 0);
  clock.advance(1); assert.equal(state.active.y, 1);
  assert.equal(clock.jobs.size, 1);
});

test('blocked spawn stops gravity; restart schedules one fresh interval', () => {
  const { clock, state, session } = setup();
  state.active.y = 18;
  state.board[0][4] = 'T';
  clock.advance(1000);
  assert.equal(state.status, 'game-over');
  assert.equal(clock.jobs.size, 0);
  const snapshot = structuredClone(state);
  for (const action of ['left', 'right', 'rotate', 'down', 'pause']) session.dispatch(action);
  clock.advance(5000); assert.deepEqual(state, snapshot);
  session.dispatch('restart'); session.dispatch('restart');
  assert.equal(clock.jobs.size, 1);
  clock.advance(999); assert.equal(state.active.y, 0);
  clock.advance(1); assert.equal(state.active.y, 1);
});

test('suspension and idempotent stop invalidate ticks without changing gameplay status', () => {
  const { clock, state, session } = setup();
  const stale = clock.history[0];
  session.setSuspended(true);
  session.dispatch('down'); stale(); clock.advance(5000);
  assert.equal(state.active.y, 0);
  assert.equal(state.status, 'running');
  session.setSuspended(false); session.setSuspended(false);
  assert.equal(clock.jobs.size, 1);
  clock.advance(999); assert.equal(state.active.y, 0);
  clock.advance(1); assert.equal(state.active.y, 1);
  session.stop(); session.stop(); session.dispatch('down');
  clock.advance(5000); assert.equal(state.active.y, 1);
  assert.equal(clock.jobs.size, 0);
});

test('running, paused and game-over frames fit 24 by 40 with contextual controls', () => {
  const { state, session } = setup();
  for (const status of ['running', 'paused', 'game-over']) {
    state.status = status;
    state.score = Number.MAX_VALUE;
    const frame = renderFrame(state).replace(/\x1b\[[0-9;]*m/g, '');
    assert.equal(frame.split('\n').length, 24);
    assert.ok(frame.split('\n').every(row => row.length <= 40));
    if (status === 'paused') { assert.match(frame, /Paused/); assert.match(frame, /P:resume/); }
  }
  session.stop();
});
