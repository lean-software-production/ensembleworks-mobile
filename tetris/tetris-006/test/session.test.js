'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const {
  HIDE_CURSOR, MIN_COLUMNS, MIN_ROWS, REDRAW_PREFIX, SHOW_CURSOR, main, startInteractiveSession,
} = require('../src/index');
const { createGame, createPieceSource } = require('../src/game');

function fakeClock() {
  let nextId = 1;
  const timers = new Map();
  return {
    setInterval(callback) { timers.set(nextId, callback); return nextId++; },
    clearInterval(id) { timers.delete(id); },
    fire() { for (const callback of [...timers.values()]) callback(); },
    get count() { return timers.size; },
  };
}

function fakeInput() {
  const input = new EventEmitter();
  input.isTTY = true;
  input.rawModes = [];
  input.resumed = 0;
  input.paused = 0;
  input.setRawMode = (value) => input.rawModes.push(value);
  input.resume = () => { input.resumed += 1; };
  input.pause = () => { input.paused += 1; };
  return input;
}

function fakeOutput(columns = 80, rows = 24) {
  const output = new EventEmitter();
  output.isTTY = true;
  output.columns = columns;
  output.rows = rows;
  output.writes = [];
  output.write = (value) => { output.writes.push(value); };
  return output;
}

test('interactive frames redraw in place and gravity redraws rather than appending frames', () => {
  const input = fakeInput();
  const output = fakeOutput();
  const clock = fakeClock();
  const runtime = new EventEmitter();
  const session = startInteractiveSession({ input, output, scheduler: clock, processObject: runtime });

  assert.equal(output.writes[0], HIDE_CURSOR);
  assert.ok(output.writes[1].startsWith(REDRAW_PREFIX));
  clock.fire();
  assert.ok(output.writes[2].startsWith(REDRAW_PREFIX));
  assert.equal(clock.count, 1);
  session.cleanup();
});

test('quit, interruption, and repeated cleanup restore terminal resources', () => {
  const input = fakeInput();
  const output = fakeOutput();
  const clock = fakeClock();
  const runtime = new EventEmitter();
  const session = startInteractiveSession({ input, output, scheduler: clock, processObject: runtime });

  input.emit('data', 'q');
  assert.equal(session.closed, true);
  assert.deepEqual(input.rawModes, [true, false]);
  assert.equal(input.paused, 1);
  assert.equal(clock.count, 0);
  assert.equal(input.listenerCount('data'), 0);
  assert.equal(output.listenerCount('resize'), 0);
  assert.equal(output.writes.at(-1), SHOW_CURSOR);
  assert.equal(session.cleanup(), false);
  assert.equal(output.writes.filter((write) => write === SHOW_CURSOR).length, 1);

  const second = startInteractiveSession({ input: fakeInput(), output: fakeOutput(), scheduler: fakeClock(), processObject: runtime });
  runtime.emit('SIGINT');
  assert.equal(second.closed, true);
  assert.equal(runtime.exitCode, 130);
});

test('entry point integration handles falling, clearing, game over, restart, and quit within 24 rows', () => {
  const input = fakeInput();
  const output = fakeOutput();
  const clock = fakeClock();
  const runtime = new EventEmitter();
  const game = createGame({ pieceSource: createPieceSource({ sequence: ['I', 'O', 'T'] }) });

  // The first falling I completes this nearly full bottom row.
  for (let x = 0; x < 10; x += 1) {
    if (x < 3 || x > 6) game.board[19][x] = true;
  }
  const session = main({ input, output, scheduler: clock, processObject: runtime, game });
  assert.ok(session, 'TTY launch should start an interactive session');
  input.emit('data', '\u001b[D\u001b[C');
  for (let tick = 0; tick < 20; tick += 1) clock.fire();
  assert.equal(game.score, 100);
  assert.equal(game.activePiece.type, 'O');

  // Ground the O and obstruct the following T spawn to reach game over.
  game.activePiece.y = 18;
  game.board[0][3] = true;
  clock.fire();
  assert.equal(game.gameOver, true);
  assert.equal(game.activePiece, null);

  input.emit('data', 'r');
  assert.equal(game.gameOver, false);
  assert.equal(game.score, 0);
  assert.ok(game.activePiece);
  input.emit('data', 'q');
  assert.equal(session.closed, true);
  assert.ok(output.writes.filter((write) => write.startsWith(REDRAW_PREFIX)).every((write) =>
    write.slice(REDRAW_PREFIX.length).split('\n').length <= 24,
  ));
});

test('small terminals show a fitting warning and resize back to the bounded game', () => {
  const input = fakeInput();
  const output = fakeOutput(12, 1);
  const clock = fakeClock();
  const runtime = new EventEmitter();
  const session = startInteractiveSession({ input, output, scheduler: clock, processObject: runtime });

  const warning = output.writes[1].slice(REDRAW_PREFIX.length);
  assert.ok(warning.length <= output.columns);
  assert.equal(warning.split('\n').length, 1);
  assert.equal(clock.count, 0);

  output.columns = MIN_COLUMNS;
  output.rows = MIN_ROWS;
  output.emit('resize');
  const frame = output.writes.at(-1).slice(REDRAW_PREFIX.length);
  assert.equal(frame.split('\n').length, MIN_ROWS);
  assert.equal(clock.count, 1);
  session.cleanup();
});
