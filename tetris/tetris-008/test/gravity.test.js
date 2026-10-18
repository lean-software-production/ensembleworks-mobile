import test from 'node:test';
import assert from 'node:assert/strict';
import { createGravityController, GRAVITY_MS } from '../src/gravity.js';
import { createInitialGame, spawnPiece } from '../src/model.js';
import { renderFrame } from '../src/render.js';

function clock() {
  let now = 0;
  let id = 0;
  const timers = new Map();
  return {
    timers,
    setInterval(fn, delay) { const key = ++id; timers.set(key, { fn, delay, next: now + delay }); return key; },
    clearInterval(key) { timers.delete(key); },
    advance(ms) {
      const end = now + ms;
      while (true) {
        const due = [...timers.entries()].filter(([, t]) => t.next <= end).sort((a, b) => a[1].next - b[1].next)[0];
        if (!due) break;
        const [key, timer] = due;
        now = timer.next;
        timer.next += timer.delay;
        timer.fn();
        if (!timers.has(key)) continue;
      }
      now = end;
    },
  };
}

const source = () => ({ next: () => 'O', reset() {} });

test('fixed gravity steps once per interval; pause and resume reset the interval', () => {
  const scheduler = clock();
  const frames = [];
  const controller = createGravityController({ game: createInitialGame({ source: source() }), source: source(), scheduler, onChange: game => frames.push(renderFrame(game)) });
  controller.start();
  controller.start();
  assert.equal(scheduler.timers.size, 1);
  scheduler.advance(999);
  assert.equal(controller.game.active.y, 0);
  scheduler.advance(1);
  assert.equal(controller.game.active.y, 1);
  scheduler.advance(500);
  controller.pause();
  assert.equal(scheduler.timers.size, 0);
  assert.equal(controller.game.status, 'paused');
  assert.match(frames.at(-1), /Paused  P: resume/);
  scheduler.advance(5000);
  assert.equal(controller.game.active.y, 1);
  controller.resume();
  controller.resume();
  assert.equal(scheduler.timers.size, 1);
  scheduler.advance(999);
  assert.equal(controller.game.active.y, 1);
  scheduler.advance(1);
  assert.equal(controller.game.active.y, 2);
  assert.ok(frames.every(frame => frame.split('\n').length === 24 && frame.split('\n').every(line => line.length <= 50)));
  controller.stop();
  assert.equal(scheduler.timers.size, 0);
});

test('grounded tick locks exactly once; game over stops ticking and restart starts fresh', () => {
  const scheduler = clock();
  const pieces = source();
  const initial = createInitialGame({ source: pieces });
  const grounded = { ...initial, active: { ...spawnPiece('O'), y: 18 } };
  const controller = createGravityController({ game: grounded, source: pieces, scheduler });
  controller.start();
  scheduler.advance(GRAVITY_MS);
  assert.equal(controller.game.board[19][4], 'O');
  assert.equal(controller.game.active.y, 0);
  assert.equal(scheduler.timers.size, 1);
  controller.stop();

  // A grounded piece blocks the following spawn at its centered top cells.
  const board = initial.board.map(row => [...row]);
  board[0][4] = 'T';
  const overGame = { ...initial, board, active: { ...spawnPiece('O'), x: 0, y: 18 } };
  const over = createGravityController({ game: overGame, source: pieces, scheduler });
  over.start();
  scheduler.advance(GRAVITY_MS);
  assert.equal(over.game.status, 'over');
  assert.equal(scheduler.timers.size, 0);
  const ended = over.game;
  scheduler.advance(10000);
  over.pause();
  over.resume();
  assert.strictEqual(over.game, ended);
  over.restart();
  assert.equal(over.game.status, 'running');
  assert.equal(over.game.score, 0);
  assert.equal(scheduler.timers.size, 1);
  scheduler.advance(999);
  assert.equal(over.game.active.y, 0);
  scheduler.advance(1);
  assert.equal(over.game.active.y, 1);
  over.stop();
});
