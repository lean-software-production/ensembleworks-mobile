"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { BOARD_HEIGHT, BOARD_WIDTH, renderFrame } = require("../src/frame");
const {
  PIECES,
  PIECE_NAMES,
  canPlace,
  createBoard,
  createGame,
  createPieceSource,
  makeActivePiece,
  moveLeft,
  moveRight,
  rotateClockwise
} = require("../src/game");

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

test("placement rejects board edges, occupied cells, and cells above the visible board", () => {
  const board = createBoard();
  board[1][1] = "J";
  assert.equal(canPlace(board, [{ x: 0, y: 0 }]), true);
  assert.equal(canPlace(board, [{ x: -1, y: 0 }]), false);
  assert.equal(canPlace(board, [{ x: 10, y: 0 }]), false);
  assert.equal(canPlace(board, [{ x: 0, y: -1 }]), false);
  assert.equal(canPlace(board, [{ x: 0, y: 20 }]), false);
  assert.equal(canPlace(board, [{ x: 1, y: 1 }]), false);
});

test("every shape moves one column through open space without mutating the board", () => {
  for (const type of PIECE_NAMES) {
    const game = createGame({ pieceSource: () => type });
    const boardBefore = structuredClone(game.board);
    const movedLeft = moveLeft(game);
    const movedRight = moveRight(game);

    assert.deepEqual(movedLeft.active.cells, game.active.cells.map(({ x, y }) => ({ x: x - 1, y })), type);
    assert.deepEqual(movedRight.active.cells, game.active.cells.map(({ x, y }) => ({ x: x + 1, y })), type);
    assert.equal(movedLeft.active.x, game.active.x - 1, type);
    assert.equal(movedRight.active.x, game.active.x + 1, type);
    assert.deepEqual(game.board, boardBefore, type);
  }
});

test("horizontal movement stops at both walls and repeated blocked actions preserve state", () => {
  for (const type of PIECE_NAMES) {
    let game = createGame({ pieceSource: () => type });
    while (moveLeft(game) !== game) game = moveLeft(game);
    const atLeftWall = game;
    assert.equal(moveLeft(game), atLeftWall, `${type} left wall`);
    assert.equal(moveLeft(game), atLeftWall, `${type} repeated left wall`);
    assert.deepEqual(game.board, createBoard(), `${type} left board`);

    while (moveRight(game) !== game) game = moveRight(game);
    const atRightWall = game;
    assert.equal(moveRight(game), atRightWall, `${type} right wall`);
    assert.equal(moveRight(game), atRightWall, `${type} repeated right wall`);
    assert.deepEqual(game.board, createBoard(), `${type} right board`);
  }
});

test("settled cells block horizontal movement for every shape without board corruption", () => {
  for (const type of PIECE_NAMES) {
    const game = createGame({ pieceSource: () => type });
    const rightmost = game.active.cells.reduce((right, cell) => cell.x > right.x ? cell : right);
    game.board[rightmost.y][rightmost.x + 1] = "Z";
    const before = structuredClone(game);

    assert.equal(moveRight(game), game, type);
    assert.deepEqual(game, before, type);
  }
});

function relativeCells(active) {
  return active.cells.map(({ x, y }) => [x - active.x, y - active.y]);
}

function at(game, x, y) {
  const dx = x - game.active.x;
  const dy = y - game.active.y;
  return {
    ...game,
    active: {
      ...game.active,
      x,
      y,
      cells: game.active.cells.map((cell) => ({ x: cell.x + dx, y: cell.y + dy }))
    }
  };
}

test("clockwise rotation has defined first orientations for every tetromino", () => {
  const expected = {
    I: [[0, 0], [0, 1], [0, 2], [0, 3]],
    O: [[0, 0], [1, 0], [0, 1], [1, 1]],
    T: [[1, 0], [1, 1], [1, 2], [0, 1]],
    S: [[1, 1], [1, 2], [0, 0], [0, 1]],
    Z: [[1, 0], [1, 1], [0, 1], [0, 2]],
    J: [[1, 0], [0, 0], [0, 1], [0, 2]],
    L: [[1, 2], [0, 0], [0, 1], [0, 2]]
  };

  for (const type of PIECE_NAMES) {
    const game = createGame({ pieceSource: () => type });
    const rotated = rotateClockwise(game);
    assert.deepEqual(relativeCells(rotated.active), expected[type], type);
    assert.equal(rotated.active.rotation, type === "O" ? 0 : 1, type);
    assert.deepEqual(game.board, createBoard(), type);
  }
});

test("four clockwise rotations restore every piece orientation and footprint", () => {
  for (const type of PIECE_NAMES) {
    const game = createGame({ pieceSource: () => type });
    let rotated = game;
    for (let count = 0; count < 4; count += 1) rotated = rotateClockwise(rotated);
    assert.equal(rotated.active.rotation, 0, type);
    assert.deepEqual(rotated.active.cells, game.active.cells, type);
    assert.deepEqual(rotated.board, game.board, type);
  }
});

test("rotation is allowed in open space and preserves the square footprint", () => {
  for (const type of PIECE_NAMES) {
    const game = at(createGame({ pieceSource: () => type }), 4, 8);
    const rotated = rotateClockwise(game);
    assert.notEqual(rotated, game, type);
    assert.equal(canPlace(rotated.board, rotated.active.cells), true, type);
  }

  const square = at(createGame({ pieceSource: () => "O" }), 4, 8);
  assert.deepEqual(rotateClockwise(square).active.cells, square.active.cells);
});

test("no-wall-kick rotation rejects walls, floor, and settled cells without mutation", () => {
  const wall = at(rotateClockwise(at(createGame({ pieceSource: () => "T" }), 4, 4)), 8, 4);
  const wallBefore = structuredClone(wall);
  assert.equal(rotateClockwise(wall), wall, "right wall");
  assert.deepEqual(wall, wallBefore);

  const floor = at(createGame({ pieceSource: () => "I" }), 4, 17);
  const floorBefore = structuredClone(floor);
  assert.equal(rotateClockwise(floor), floor, "floor");
  assert.deepEqual(floor, floorBefore);

  const blocked = at(createGame({ pieceSource: () => "T" }), 4, 8);
  blocked.board[8][5] = "L";
  const blockedBefore = structuredClone(blocked);
  assert.equal(rotateClockwise(blocked), blocked, "settled cell");
  assert.deepEqual(blocked, blockedBefore);
});
