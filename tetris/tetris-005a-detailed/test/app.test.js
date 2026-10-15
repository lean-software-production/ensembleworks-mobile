"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");
const { KeyDecoder, createLiveGame } = require("../src/app");
const { createGame } = require("../src/game");

class FakeOutput {
  constructor() { this.writes = []; }
  write(text) { this.writes.push(text); }
}

class FakeTimers {
  constructor() { this.callback = null; this.cleared = []; }
  setInterval(callback, interval) {
    this.callback = callback;
    this.interval = interval;
    return 41;
  }
  clearInterval(id) { this.cleared.push(id); }
  tick() { this.callback?.(); }
}

function live(options = {}) {
  const input = new EventEmitter();
  const output = new FakeOutput();
  const timers = new FakeTimers();
  const app = createLiveGame({
    input,
    output,
    timers,
    pieceSource: () => "O",
    ...options
  });
  app.start();
  return { app, input, output, timers };
}

test("key decoder accepts split arrows, combined keys, and ignores unsupported input", () => {
  const decoder = new KeyDecoder();
  assert.deepEqual(decoder.push("\x1b"), []);
  assert.deepEqual(decoder.push("[A\x1b[D?x\x1b[C\x1b[B"), ["rotate", "left", "right", "down"]);
  assert.deepEqual(decoder.push(" \x03Q"), ["drop", "quit", "quit"]);
  assert.deepEqual(decoder.push("\x1bq"), ["quit"], "unsupported escape prefixes do not swallow keys");
});

test("live adapter maps every documented gameplay key and redraws complete frames", () => {
  const { app, input, output } = live({ pieceSource: () => "I", game: createGame({ pieceSource: () => "I" }) });
  const initialX = app.game.active.x;

  // A combined event exercises left, right, rotate, down, and hard drop.
  input.emit("data", Buffer.from("\x1b[D\x1b[C\x1b[A\x1b[B "));

  assert.equal(app.game.active.type, "I", "space locks the I and spawns its successor");
  assert.equal(app.game.board.flat().filter((cell) => cell === "I").length, 4);
  assert.equal(initialX, 3);
  assert.ok(output.writes.length >= 6, "initial frame plus one redraw per action");
  assert.ok(output.writes.every((frame) => frame.startsWith("\x1b[2J\x1b[H")));
  assert.match(output.writes.at(-1), /Score: 0/);
});

test("repeated input and idle gravity use the engine while unsupported input is safe", () => {
  const { app, input, timers } = live({ game: createGame({ pieceSource: () => "T" }) });
  input.emit("data", Buffer.from("\x1b[D\x1b[D?"));
  assert.equal(app.game.active.x, 1, "two left keys each move one column");
  assert.equal(app.game.active.y, 0, "unsupported input does not change the game");

  timers.tick();
  assert.equal(app.game.active.y, 1, "one fixed gravity interval descends once");
  assert.equal(timers.interval, 1000);
});

test("undersized terminals pause gameplay, show a bounded warning, and reset gravity on resize", () => {
  const input = new EventEmitter();
  const output = new EventEmitter();
  output.writes = [];
  output.rows = 24;
  output.columns = 53;
  output.write = (text) => output.writes.push(text);
  const timers = new FakeTimers();
  const app = createLiveGame({ input, output, timers, pieceSource: () => "T" });
  app.start();
  assert.equal(app.paused, false, "the documented exact-fit size plays");

  output.rows = 23;
  output.emit("resize");
  assert.equal(app.paused, true);
  assert.match(output.writes.at(-1), /Terminal too small/);
  assert.ok(output.writes.at(-1).split("\n").length <= 1);
  const y = app.game.active.y;
  input.emit("data", "\x1b[B");
  timers.tick();
  assert.equal(app.game.active.y, y, "input and gravity do not run while paused");

  output.rows = 24;
  output.columns = 52;
  output.emit("resize");
  assert.equal(app.paused, true, "width is checked independently");
  assert.ok(output.writes.at(-1).replace(/^\x1b\[2J\x1b\[H/, "").length <= 52);

  app.game.gravityElapsed = 500;
  output.columns = 53;
  output.emit("resize");
  assert.equal(app.paused, false);
  assert.equal(app.game.gravityElapsed, 0, "resuming drops paused timing debt");
  timers.tick();
  assert.equal(app.game.active.y, y + 1);

  app.quit();
  const writesAfterQuit = output.writes.length;
  output.emit("resize");
  timers.tick();
  assert.equal(output.writes.length, writesAfterQuit, "resize and timer callbacks are detached after exit");
});

test("quit works after game over and cancels the live timer with no later callbacks", () => {
  const base = createGame({ pieceSource: () => "I" });
  const gameOver = { ...base, active: null, gameOver: true };
  let quits = 0;
  const { app, input, timers, output } = live({ game: gameOver, onQuit: () => { quits += 1; } });
  const framesBeforeQuit = output.writes.length;

  input.emit("data", Buffer.from("q"));
  assert.equal(app.exited, true);
  assert.equal(quits, 1);
  assert.deepEqual(timers.cleared, [41]);
  timers.tick();
  assert.equal(output.writes.length, framesBeforeQuit, "a canceled timer cannot redraw after exit");
  app.quit();
  assert.equal(quits, 1, "cleanup is idempotent");
});
