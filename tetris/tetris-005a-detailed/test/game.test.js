"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { BOARD_HEIGHT, BOARD_WIDTH, renderFrame } = require("../src/frame");
const { PIECES, PIECE_NAMES, createBoard, createGame, createPieceSource, makeActivePiece } = require("../src/game");

const key = ({ x, y }) => `${x},${y}`;

test("all seven tetromino definitions have four distinct cells", () => {
  assert.deepEqual(PIECE_NAMES, ["I", "O", "T", "S", "Z", "J", "L"]);
  for (const type of PIECE_NAMES) {
    const cells = PIECES[type];
    assert.equal(cells.length, 4, type);
    assert.equal(new Set(cells.map(([x, y]) => `${x},${y}`)).size, 4, type);
  }
});

test("every piece spawns centered at the visible top of an empty board", () => {
  for (const type of PIECE_NAMES) {
    const game = createGame({ pieceSource: () => type });
    assert.equal(game.active.type, type);
    assert.equal(game.active.cells.length, 4);
    for (const cell of game.active.cells) {
      assert.ok(cell.x >= 0 && cell.x < BOARD_WIDTH, `${type} x=${cell.x}`);
      assert.ok(cell.y >= 0 && cell.y < BOARD_HEIGHT, `${type} y=${cell.y}`);
    }
    assert.equal(game.active.y, 0);
    const minX = Math.min(...game.active.cells.map(({ x }) => x));
    const maxX = Math.max(...game.active.cells.map(({ x }) => x));
    assert.equal(minX, Math.floor((BOARD_WIDTH - (maxX - minX + 1)) / 2));
    assert.deepEqual(game.board, createBoard());
  }
});

test("injected piece sources select deterministically", () => {
  assert.equal(createGame({ pieceSource: () => "L" }).active.type, "L");
  assert.equal(createPieceSource(() => 0)(), "I");
  assert.equal(createPieceSource(() => 0.999999)(), "L");
});

test("fresh boards are independent", () => {
  const first = createGame({ pieceSource: () => "O" });
  const second = createGame({ pieceSource: () => "O" });
  first.board[0][0] = "I";
  assert.equal(second.board[0][0], null);
  assert.notEqual(first.board, second.board);
  assert.notEqual(first.board[0], second.board[0]);
});

test("rendering overlays the active piece without changing settled cells", () => {
  const board = createBoard();
  board[19][0] = "J";
  const before = structuredClone(board);
  const active = makeActivePiece("T");
  const frame = renderFrame({ board, activePiece: active });
  const lines = frame.split("\n");

  assert.deepEqual(board, before);
  for (const cell of active.cells) {
    assert.equal(lines[cell.y + 1][cell.x + 1], "█", key(cell));
  }
  assert.equal(lines[20][1], "█");
});
