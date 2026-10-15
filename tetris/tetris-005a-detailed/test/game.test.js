"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { BOARD_HEIGHT, BOARD_WIDTH, renderFrame } = require("../src/frame");
const {
  PIECES,
  PIECE_NAMES,
  GRAVITY_INTERVAL_MS,
  LINE_CLEAR_SCORES,
  MAX_GRAVITY_STEPS,
  advanceGravity,
  canPlace,
  clearCompletedRows,
  createBoard,
  createGame,
  createPieceSource,
  makeActivePiece,
  moveDown,
  moveLeft,
  moveRight,
  rotateClockwise,
  scoreForLineClear
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
    assert.equal(game.score, 0);
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

test("downward movement advances one row without settling or drawing a successor", () => {
  const game = at(createGame({ pieceSource: () => "T" }), 4, 8);
  let draws = 0;
  const descended = moveDown(game, () => {
    draws += 1;
    return "I";
  });

  assert.equal(descended.active.y, 9);
  assert.deepEqual(descended.active.cells, game.active.cells.map(({ x, y }) => ({ x, y: y + 1 })));
  assert.deepEqual(descended.board, game.board);
  assert.equal(descended.board, game.board);
  assert.equal(draws, 0);
});

test("floor locks every tetromino's four cells once and spawns one successor", () => {
  for (const type of PIECE_NAMES) {
    const initial = createGame({ pieceSource: () => type });
    const maxY = Math.max(...initial.active.cells.map(({ y }) => y));
    const game = at(initial, 3, BOARD_HEIGHT - 1 - maxY);
    const before = structuredClone(game.board);
    let draws = 0;
    const locked = moveDown(game, () => {
      draws += 1;
      return "L";
    });

    assert.equal(draws, 1, type);
    assert.equal(locked.active.type, "L", type);
    assert.deepEqual(locked.active, makeActivePiece("L"), type);
    assert.notEqual(locked.board, game.board, type);
    for (const { x, y } of game.active.cells) assert.equal(locked.board[y][x], type, `${type} ${x},${y}`);
    assert.equal(locked.board.flat().filter((cell) => cell === type).length, 4, type);
    assert.deepEqual(game.board, before, type);
  }
});

test("a stack blocks descent, locks without overwriting settled cells, and preserves it", () => {
  const game = at(createGame({ pieceSource: () => "T" }), 4, 8);
  game.board[10][5] = "J";
  const before = structuredClone(game.board);
  let draws = 0;
  const locked = moveDown(game, () => {
    draws += 1;
    return "O";
  });

  assert.equal(draws, 1);
  assert.equal(locked.board[10][5], "J");
  for (const { x, y } of game.active.cells) assert.equal(locked.board[y][x], "T");
  assert.equal(locked.board.flat().filter((cell) => cell === "T").length, 4);
  assert.deepEqual(game.board, before);
});

test("completed rows clear simultaneously for zero through four rows and preserve survivors", () => {
  const cases = [
    { name: "zero", fullRows: [] },
    { name: "one", fullRows: [18] },
    { name: "two adjacent", fullRows: [17, 18] },
    { name: "three separated", fullRows: [4, 10, 18] },
    { name: "four adjacent", fullRows: [16, 17, 18, 19] }
  ];

  for (const { name, fullRows } of cases) {
    const board = createBoard();
    // These incomplete rows give each surviving row an observable identity.
    board[3][0] = "I";
    board[9][0] = "J";
    board[15][0] = "L";
    for (const row of fullRows) board[row].fill("Z");
    const before = structuredClone(board);

    const cleared = clearCompletedRows(board);
    assert.equal(cleared.count, fullRows.length, name);
    assert.equal(cleared.board.length, BOARD_HEIGHT, name);
    assert.ok(cleared.board.every((row) => row.length === BOARD_WIDTH), name);
    assert.deepEqual(board, before, `${name} does not mutate input`);

    const expectedSurvivors = before.filter((_, row) => !fullRows.includes(row));
    assert.deepEqual(cleared.board.slice(fullRows.length), expectedSurvivors, name);
    assert.ok(
      cleared.board.slice(0, fullRows.length).every((row) => row.every((cell) => cell === null)),
      `${name} inserts empty rows at top`
    );
  }
});

test("locking clears rows before spawning and exposes the lock clear count", () => {
  const game = at(createGame({ pieceSource: () => "I" }), 6, BOARD_HEIGHT - 1);
  // The horizontal I completes this row without overwriting these settled cells.
  for (let x = 0; x < 6; x += 1) game.board[BOARD_HEIGHT - 1][x] = "J";
  let draws = 0;
  const locked = moveDown(game, () => {
    draws += 1;
    return "O";
  });

  assert.equal(draws, 1);
  assert.equal(locked.lastClearCount, 1);
  assert.equal(locked.active.type, "O");
  assert.deepEqual(locked.board, createBoard());
  assert.equal(game.board[BOARD_HEIGHT - 1][0], "J", "source board is unchanged");
});

test("fixed line-clear score table awards the documented values", () => {
  assert.deepEqual(LINE_CLEAR_SCORES, [0, 100, 300, 500, 800]);
  for (const [count, score] of LINE_CLEAR_SCORES.entries()) {
    assert.equal(scoreForLineClear(count), score, `${count} rows`);
  }
});

function gameThatWillClear(score, rowsToClear) {
  const game = at(createGame({ pieceSource: () => "O" }), 0, BOARD_HEIGHT - 2);
  game.score = score;
  for (let y = 14; y < 14 + rowsToClear; y += 1) game.board[y].fill("J");
  return game;
}

test("locking awards each line-clear score once and awards nothing for no clear", () => {
  for (const [count, points] of LINE_CLEAR_SCORES.entries()) {
    let draws = 0;
    const locked = moveDown(gameThatWillClear(0, count), () => {
      draws += 1;
      return "T";
    });

    assert.equal(draws, 1, `${count} rows draws one successor`);
    assert.equal(locked.lastClearCount, count, `${count} rows cleared`);
    assert.equal(locked.score, points, `${count} rows score`);
  }
});

test("scores accumulate only across lock transitions, not rendering or movement", () => {
  const first = moveDown(gameThatWillClear(0, 1), () => "O");
  const second = moveDown(gameThatWillClear(first.score, 4), () => "I");

  assert.equal(first.score, 100);
  assert.equal(second.score, 900);
  assert.equal(moveLeft(second).score, 900);
  assert.equal(moveRight(second).score, 900);
  assert.equal(rotateClockwise(second).score, 900);
  assert.match(renderFrame({ board: second.board, activePiece: second.active, score: second.score }), /Score: 900/);
});

test("gravity waits for a complete fixed interval", () => {
  const game = at(createGame({ pieceSource: () => "T" }), 4, 8);
  const updated = advanceGravity(game, GRAVITY_INTERVAL_MS - 1, () => "I");

  assert.equal(updated.active.y, 8);
  assert.equal(updated.gravityElapsed, GRAVITY_INTERVAL_MS - 1);
  assert.equal(updated.board, game.board);
});

test("gravity descends exactly once at an interval and accumulates partial updates", () => {
  const game = at(createGame({ pieceSource: () => "T" }), 4, 8);
  const once = advanceGravity(game, GRAVITY_INTERVAL_MS, () => "I");
  assert.equal(once.active.y, 9);
  assert.equal(once.gravityElapsed, 0);

  const partial = advanceGravity(game, 400, () => "I");
  const accumulated = advanceGravity(partial, 600, () => "I");
  assert.equal(partial.active.y, 8);
  assert.equal(accumulated.active.y, 9);
  assert.equal(accumulated.gravityElapsed, 0);
});

test("a large gravity update is capped at a deterministic number of descents", () => {
  const game = createGame({ pieceSource: () => "T" });
  let draws = 0;
  const updated = advanceGravity(game, GRAVITY_INTERVAL_MS * 100, () => {
    draws += 1;
    return "I";
  });

  assert.equal(updated.active.y, MAX_GRAVITY_STEPS);
  assert.equal(updated.gravityElapsed, 0);
  assert.equal(draws, 0);
});

test("gravity locking spawns once and discards remaining timing debt", () => {
  const initial = createGame({ pieceSource: () => "O" });
  const game = at(initial, 4, BOARD_HEIGHT - 2);
  let draws = 0;
  const locked = advanceGravity(game, GRAVITY_INTERVAL_MS * 5, () => {
    draws += 1;
    return "L";
  });

  assert.equal(draws, 1);
  assert.equal(locked.active.type, "L");
  assert.equal(locked.active.y, 0);
  assert.equal(locked.gravityElapsed, 0);
  for (const { x, y } of game.active.cells) assert.equal(locked.board[y][x], "O");
});

function groundedI() {
  return at(createGame({ pieceSource: () => "I" }), 0, BOARD_HEIGHT - 1);
}

test("a blocked successor spawn ends the game while retaining the final board and score", () => {
  const game = groundedI();
  // O spawns at columns 4–5 in rows 0–1, so this settled cell blocks it.
  game.board[0][4] = "J";
  const over = moveDown(game, () => "O");

  assert.equal(over.gameOver, true);
  assert.equal(over.active, null);
  assert.equal(over.board[0][4], "J");
  for (const cell of game.active.cells) assert.equal(over.board[cell.y][cell.x], "I");
  assert.equal(over.score, 0);
});

test("a clear is applied before the successor spawn check", () => {
  const game = groundedI();
  // This row would obstruct every spawn, but it is removed as part of locking.
  game.board[0].fill("Z");
  const next = moveDown(game, () => "O");

  assert.equal(next.gameOver, false);
  assert.equal(next.active.type, "O");
  assert.equal(next.lastClearCount, 1);
  assert.equal(next.board[0][4], null);
});

test("an unobstructed near-top successor spawns normally", () => {
  const game = groundedI();
  game.board[0][0] = "J";
  const next = moveDown(game, () => "T");

  assert.equal(next.gameOver, false);
  assert.equal(next.active.type, "T");
  assert.equal(canPlace(next.board, next.active.cells), true);
});

test("game-over states reject gameplay actions and do not draw another piece", () => {
  const game = groundedI();
  game.board[0][4] = "J";
  const over = moveDown(game, () => "O");
  let draws = 0;
  const source = () => {
    draws += 1;
    return "L";
  };

  assert.equal(moveLeft(over), over);
  assert.equal(moveRight(over), over);
  assert.equal(rotateClockwise(over), over);
  assert.equal(moveDown(over, source), over);
  assert.equal(advanceGravity(over, GRAVITY_INTERVAL_MS, source), over);
  assert.equal(draws, 0);
});

test("above-board cells are never legal placements", () => {
  const board = createBoard();
  assert.equal(canPlace(board, [{ x: 4, y: -1 }]), false);
});
