"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");
const { createTerminalSession } = require("../src/terminal");

test("terminal session enters modes and restores them once on signals and cleanup", () => {
  const input = new EventEmitter();
  input.modes = [];
  input.setRawMode = (value) => input.modes.push(value);
  input.resume = () => { input.resumed = true; };
  input.pause = () => { input.paused = true; };
  const output = { writes: [], write(text) { this.writes.push(text); } };
  const processRef = new EventEmitter();
  let terminations = 0;
  const session = createTerminalSession({ input, output, processRef, onTerminate: () => { terminations += 1; } });

  session.start(() => {});
  assert.deepEqual(input.modes, [true]);
  assert.equal(output.writes[0], "\x1b[?1049h\x1b[?25l");
  processRef.emit("SIGTERM");
  assert.equal(terminations, 1);
  session.cleanup();
  session.cleanup();
  assert.deepEqual(input.modes, [true, false]);
  assert.equal(output.writes.at(-1), "\x1b[?25h\x1b[?1049l");
  processRef.emit("SIGINT");
  assert.equal(terminations, 1, "signal listeners are removed during cleanup");
});

test("terminal session restores modes when application startup throws", () => {
  const input = { modes: [], setRawMode(value) { this.modes.push(value); }, resume() {}, pause() {} };
  const output = { writes: [], write(text) { this.writes.push(text); } };
  const session = createTerminalSession({ input, output, processRef: new EventEmitter() });
  assert.throws(() => session.start(() => { throw new Error("draw failed"); }), /draw failed/);
  assert.deepEqual(input.modes, [true, false]);
  assert.equal(output.writes.at(-1), "\x1b[?25h\x1b[?1049l");
});
