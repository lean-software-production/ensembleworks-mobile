"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");
const { BOARD_HEIGHT, BOARD_WIDTH, FRAME_MIN_COLUMNS, FRAME_ROWS, renderFrame, renderSizeWarning } = require("../src/frame");

const stripAnsi = (text) => text.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");

test("empty frame has a bounded 10 by 20 board and required labels", () => {
  const lines = stripAnsi(renderFrame()).split("\n");
  const boardRows = lines.filter((line) => /^│ {10}│/.test(line));

  assert.equal(BOARD_WIDTH, 10);
  assert.equal(BOARD_HEIGHT, 20);
  assert.equal(lines.length, 23);
  assert.ok(lines.length <= 24);
  assert.equal(boardRows.length, 20);
  assert.match(lines[0], /^┌──────────┐/);
  assert.match(lines[0], /TETRIS/);
  assert.match(lines[0], /Score: 0/);
  assert.equal(lines[21], "└──────────┘");
  assert.match(lines[22], /move/);
  assert.match(lines[22], /rotate/);
  assert.match(lines[22], /Q\/Ctrl-C quit/);
});

test("normal frames fit their documented minimum terminal dimensions", () => {
  const lines = renderFrame({ score: 999999999999999999999999999999999999999999999 }).split("\n");
  assert.equal(FRAME_MIN_COLUMNS, 53);
  assert.equal(FRAME_ROWS, 24);
  assert.ok(lines.length <= FRAME_ROWS);
  assert.ok(lines.every((line) => line.length <= FRAME_MIN_COLUMNS));
  assert.equal(renderSizeWarning({ rows: 1, columns: 12 }).length, 12);
  assert.equal(renderSizeWarning({ rows: 0, columns: 12 }), "");
});

test("rendered score is included without changing frame height", () => {
  const lines = renderFrame({ score: 123456789 }).split("\n");
  assert.equal(lines.length, 23);
  assert.match(lines[0], /Score: 123456789/);
});

test("game-over frame remains within 24 rows and shows the terminal message", () => {
  const lines = renderFrame({ score: 800, gameOver: true }).split("\n");

  assert.equal(lines.length, 24);
  assert.ok(lines.length <= 24);
  assert.match(lines[23], /GAME OVER/);
  assert.match(lines[0], /Score: 800/);
});

test("entry point prints one frame and exits when it is not attached to a TTY", () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, "..", "index.js")], {
    encoding: "utf8",
    timeout: 2_000
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.signal, null);
  const lines = stripAnsi(result.stdout.trimEnd()).split("\n");
  assert.equal(lines.length, 23);
  assert.match(lines[0], /TETRIS  Score: 0/);
});
