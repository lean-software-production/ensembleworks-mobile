'use strict';

const { EventEmitter } = require('node:events');
const test = require('node:test');
const assert = require('node:assert/strict');
const { TetrisGame } = require('../src/tetris');
const { TerminalTetris } = require('../src/terminal');

function controls() {
  const calls = [];
  const game = {
    gameOver: false,
    level: 1,
    moveLeft: () => calls.push('left'),
    moveRight: () => calls.push('right'),
    softDrop: () => calls.push('down'),
    rotate: () => calls.push('rotate'),
    hardDrop: () => calls.push('drop')
  };
  return { game, calls };
}

function terminalFor(game) {
  const terminal = new TerminalTetris({ game, input: new EventEmitter(), output: { write() {} } });
  terminal.render = () => {};
  terminal.scheduleGravity = () => {};
  return terminal;
}

function controlledClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    clearTimeout(id) { timers.delete(id); },
    setTimeout(callback, delay) {
      const id = nextId += 1;
      timers.set(id, { callback, due: now + delay });
      return id;
    },
    advance(milliseconds) {
      const target = now + milliseconds;
      while (true) {
        const next = [...timers.entries()]
          .filter(([, timer]) => timer.due <= target)
          .sort(([, a], [, b]) => a.due - b.due)[0];
        if (!next) break;
        const [id, timer] = next;
        timers.delete(id);
        now = timer.due;
        timer.callback();
      }
      now = target;
    }
  };
}

test('decodes fragmented arrow keys and coalesced movement keys in order', () => {
  const { game, calls } = controls();
  const terminal = terminalFor(game);

  terminal.handleInput('\x1b');
  assert.deepEqual(calls, []);
  terminal.handleInput('[D\x1b[Dd');

  assert.deepEqual(calls, ['left', 'left', 'right']);
});

test('renders processed movement before retaining a fragmented escape sequence', () => {
  const { game, calls } = controls();
  const terminal = terminalFor(game);
  let renders = 0;
  terminal.render = () => { renders += 1; };

  terminal.handleInput('d\x1b');

  assert.deepEqual(calls, ['right']);
  assert.equal(renders, 1);
  assert.equal(terminal.inputBuffer, '\x1b');
});

test('coalesced quit input stops the terminal', () => {
  const { game } = controls();
  const terminal = terminalFor(game);
  let stops = 0;
  terminal.stop = () => { stops += 1; };

  terminal.handleInput('qq');

  assert.equal(stops, 1);
});

test('renders clear-line controls before a shorter game-over status', () => {
  const game = new TetrisGame({ random: () => 0 });
  const writes = [];
  const terminal = new TerminalTetris({
    game,
    input: new EventEmitter(),
    output: { write: (text) => writes.push(text) }
  });

  terminal.render();
  game.gameOver = true;
  terminal.render();

  assert.match(writes[0], /Next: I/);
  assert.match(writes[1], /\x1b\[2KTETRIS .*GAME OVER/);
  assert.doesNotMatch(writes[1], /Next:/);
  assert.equal((writes[1].match(/\x1b\[2K/g) || []).length, 24);
});

test('start and stop restore terminal input and remove the data listener', () => {
  const game = new TetrisGame({ random: () => 0 });
  const input = new EventEmitter();
  const modes = [];
  input.setRawMode = (enabled) => modes.push(enabled);
  input.resume = () => { input.resumed = true; };
  input.pause = () => { input.paused = true; };
  const writes = [];
  const terminal = new TerminalTetris({ game, input, output: { write: (text) => writes.push(text) } });
  terminal.scheduleGravity = () => {};

  terminal.start();
  terminal.stop();

  assert.deepEqual(modes, [true, false]);
  assert.equal(input.resumed, true);
  assert.equal(input.paused, true);
  assert.equal(input.listenerCount('data'), 0);
  assert.match(writes.at(-1), /\x1b\[\?25h\x1b\[\?1049l/);
});

test('gravity continues during repeated lateral movement input', () => {
  const clock = controlledClock();
  let ticks = 0;
  const game = {
    gameOver: false,
    level: 1,
    moveRight() {},
    tick() { ticks += 1; }
  };
  const terminal = new TerminalTetris({
    game,
    input: new EventEmitter(),
    output: { write() {} },
    clock
  });
  terminal.render = () => {};
  terminal.running = true;
  terminal.scheduleGravity();

  for (let input = 0; input < 10; input += 1) {
    terminal.handleInput('d');
    clock.advance(700);
  }

  assert.equal(ticks, 8);
});

test('gravity delay speeds up by level and has a lower bound', () => {
  const { game } = controls();
  const terminal = terminalFor(game);

  assert.equal(terminal.gravityDelay(), 800);
  game.level = 2;
  assert.equal(terminal.gravityDelay(), 740);
  game.level = 100;
  assert.equal(terminal.gravityDelay(), 120);
});
