'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { TetrisGame } = require('../game');
const { createTetrisApp } = require('../index');

function fakeClock() {
  let time = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    setTimeout(callback, delay) {
      const id = nextId++;
      timers.set(id, { callback, due: time + delay, delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    advance(milliseconds) {
      const end = time + milliseconds;
      while (true) {
        const due = [...timers.entries()]
          .filter(([, timer]) => timer.due <= end)
          .sort((a, b) => a[1].due - b[1].due)[0];
        if (!due) break;
        const [id, timer] = due;
        timers.delete(id);
        time = timer.due;
        timer.callback();
      }
      time = end;
    },
    delays() { return [...timers.values()].map(timer => timer.due - time); },
    size() { return timers.size; }
  };
}

function appWith(clock, gameFactory = () => new TetrisGame(() => 0)) {
  const output = [];
  const app = createTetrisApp({
    gameFactory,
    setTimeoutFn: clock.setTimeout,
    clearTimeoutFn: clock.clearTimeout,
    stdout: { write: value => output.push(value) },
    stdin: { isTTY: false, setRawMode() {} },
    exit() {}
  });
  return { app, output };
}

test('movement input does not postpone gravity', () => {
  const clock = fakeClock();
  const { app } = appWith(clock);
  app.start();

  for (let elapsed = 0; elapsed < 2000; elapsed += 100) {
    app.handleKey('a');
    clock.advance(100);
  }

  assert.equal(app.game.current.y, 2);
  assert.deepEqual(clock.delays(), [100]);
});

test('hard drop reschedules gravity using the new level', () => {
  const clock = fakeClock();
  const { app } = appWith(clock, () => new TetrisGame(() => 3 / 7)); // O
  app.game.lines = 9;
  app.game.board[17] = Array.from({ length: 10 }, (_, x) => x === 4 || x === 5 ? null : 'J');
  app.start();

  app.handleKey(' ');

  assert.equal(app.game.level(), 2);
  assert.deepEqual(clock.delays(), [645]);
});

test('game over cancels gravity and restart creates a fresh timer', () => {
  const clock = fakeClock();
  const { app } = appWith(clock);
  app.start();
  app.game.over = true;
  app.scheduleTick();
  assert.equal(clock.size(), 0);

  app.handleKey('r');
  assert.equal(app.game.over, false);
  assert.deepEqual(clock.delays(), [700]);
});

test('each 23-row frame clears lines so shorter game-over and restart text cannot persist', () => {
  const clock = fakeClock();
  const { app, output } = appWith(clock);
  app.game.score = 123456;
  app.start();
  const liveFrame = output.at(-1);
  assert.match(liveFrame, /Score: 123456/);
  assert.equal(liveFrame.split('\n').length, 23);
  assert.equal((liveFrame.match(/\x1b\[2K/g) || []).length, 23);

  app.game.over = true;
  app.render();
  const gameOverFrame = output.at(-1);
  assert.equal(gameOverFrame.split('\n').length, 23);
  assert.match(gameOverFrame, /GAME OVER/);
  assert.doesNotMatch(gameOverFrame, /hard drop  q quit/);

  app.handleKey('r');
  const restartFrame = output.at(-1);
  assert.match(restartFrame, /Score: 0/);
  assert.equal(restartFrame.split('\n').length, 23);
  assert.equal((restartFrame.match(/\x1b\[2K/g) || []).length, 23);
});
