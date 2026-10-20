import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/model.js';
import { createSession, GRAVITY_MS } from '../src/session.js';
import { renderFrame } from '../src/render.js';

function fakeClock() {
  let now = 0, id = 0;
  const jobs = new Map();
  return {
    jobs,
    setTimeout(fn, delay) { jobs.set(++id, { fn, due: now + delay }); return id; },
    clearTimeout(id) { jobs.delete(id); },
    advance(ms) {
      const end = now + ms;
      while (true) {
        const next = [...jobs].sort((a, b) => a[1].due - b[1].due)[0];
        if (!next || next[1].due > end) break;
        now = next[1].due; jobs.delete(next[0]); next[1].fn();
      }
      now = end;
    },
    delayed(ms) {
      now += ms;
      const ready = [...jobs].filter(([, job]) => job.due <= now);
      for (const [id, job] of ready) { jobs.delete(id); job.fn(); }
    },
  };
}

test('gravity waits a full interval and drives one move or lock per tick', () => {
  let consumed = 0, changes = 0;
  const game = createGame(() => { consumed++; return 'O'; });
  const clock = fakeClock();
  const session = createSession(game, { clock, onChange: () => changes++ });
  clock.advance(GRAVITY_MS - 1);
  assert.equal(game.active.y, 0);
  clock.advance(1);
  assert.equal(game.active.y, 1);
  assert.equal(changes, 1);
  clock.advance(17 * GRAVITY_MS);
  assert.equal(game.active.y, 18);
  assert.equal(consumed, 1);
  clock.advance(GRAVITY_MS);
  assert.equal(consumed, 2);
  assert.equal(game.active.y, 0);
  assert.equal(game.board.flat().filter(Boolean).length, 4);
  assert.equal(clock.jobs.size, 1);
  session.dispose(); session.dispose();
  clock.advance(10000);
  assert.equal(clock.jobs.size, 0);
  assert.equal(session.dispatch('down'), false);
});

test('pause freezes all gameplay; resume waits fresh interval without duplicate or stale callbacks', () => {
  const game = createGame(() => 'T');
  const clock = fakeClock();
  const session = createSession(game, { clock });
  clock.advance(900);
  const stale = [...clock.jobs.values()][0].fn;
  assert.equal(session.dispatch('pause'), true);
  const snapshot = structuredClone(game);
  for (const action of ['left', 'right', 'rotate', 'down', 'pause', 'restart']) session.dispatch(action);
  clock.advance(10000); stale();
  assert.deepEqual(game, snapshot);
  assert.equal(clock.jobs.size, 0);
  session.dispatch('resume'); session.dispatch('resume'); stale();
  assert.equal(clock.jobs.size, 1);
  clock.advance(999); assert.equal(game.active.y, 0);
  clock.advance(1); assert.equal(game.active.y, 1);
  clock.delayed(10000); assert.equal(game.active.y, 2);
  assert.equal(clock.jobs.size, 1);
  session.dispose();
});

test('legal gravity stacking reaches game over, stops, and restart owns one fresh timer', () => {
  const game = createGame(() => 'O');
  const clock = fakeClock();
  const session = createSession(game, { clock });
  clock.advance(200 * GRAVITY_MS);
  assert.equal(game.status, 'game-over');
  assert.equal(clock.jobs.size, 0);
  const snapshot = structuredClone(game);
  clock.advance(10000);
  session.dispatch('pause'); session.dispatch('resume'); session.dispatch('down');
  assert.deepEqual(game, snapshot);
  session.dispatch('restart'); session.dispatch('restart');
  assert.equal(game.status, 'running');
  assert.equal(game.score, 0);
  assert.equal(clock.jobs.size, 1);
  clock.advance(999); assert.equal(game.active.y, 0);
  clock.advance(1); assert.equal(game.active.y, 1);
  session.dispose();
});

test('running, paused and game-over frames retain 24 rows and seven-piece styling', () => {
  const game = createGame(() => 'I');
  for (const status of ['running', 'paused', 'game-over']) {
    game.status = status;
    for (const color of [false, true]) {
      const frame = renderFrame(game, { color }).replace(/\x1b\[[0-9;]*m/g, '');
      assert.equal(frame.split('\n').length, 24);
      assert.ok(!frame.endsWith('\n'));
      if (status === 'paused') {
        assert.match(frame, /Paused/);
        assert.match(frame, /p resume/);
      }
    }
  }
});
