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
