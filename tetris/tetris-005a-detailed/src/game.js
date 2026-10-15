"use strict";

const { BOARD_HEIGHT, BOARD_WIDTH } = require("./frame");

// Coordinates are the initial (clockwise rotation zero) footprint of each
// tetromino.  They are deliberately data, rather than random render output.
const PIECES = Object.freeze({
  I: Object.freeze([[0, 0], [1, 0], [2, 0], [3, 0]]),
  O: Object.freeze([[0, 0], [1, 0], [0, 1], [1, 1]]),
  T: Object.freeze([[0, 0], [1, 0], [2, 0], [1, 1]]),
  S: Object.freeze([[1, 0], [2, 0], [0, 1], [1, 1]]),
  Z: Object.freeze([[0, 0], [1, 0], [1, 1], [2, 1]]),
  J: Object.freeze([[0, 0], [0, 1], [1, 1], [2, 1]]),
  L: Object.freeze([[2, 0], [0, 1], [1, 1], [2, 1]])
});

const PIECE_NAMES = Object.freeze(Object.keys(PIECES));

// Gravity advances once per second. At most ten rows are processed by one
// elapsed-time update; excess elapsed time is deliberately discarded so a
// delayed event-loop callback cannot make a piece fall an unbounded distance.
const GRAVITY_INTERVAL_MS = 1000;
const MAX_GRAVITY_STEPS = 10;

function createBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
}

function pieceWidth(type) {
  assertPiece(type);
  return Math.max(...PIECES[type].map(([x]) => x)) + 1;
}

function assertPiece(type) {
  if (!Object.hasOwn(PIECES, type)) throw new RangeError(`Unknown tetromino: ${type}`);
}

function makeActivePiece(type) {
  assertPiece(type);
  const x = Math.floor((BOARD_WIDTH - pieceWidth(type)) / 2);
  const y = 0;
  return {
    type,
    rotation: 0,
    x,
    y,
    cells: PIECES[type].map(([cellX, cellY]) => ({ x: x + cellX, y: y + cellY }))
  };
}

/** Return a source suitable for injection into createGame. */
function createPieceSource(random = Math.random) {
  if (typeof random !== "function") throw new TypeError("random must be a function");
  return () => {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError("random must return a number from 0 (inclusive) to 1 (exclusive)");
    }
    return PIECE_NAMES[Math.floor(value * PIECE_NAMES.length)];
  };
}

function createGame({ pieceSource = createPieceSource() } = {}) {
  if (typeof pieceSource !== "function") throw new TypeError("pieceSource must be a function");
  const type = pieceSource();
  assertPiece(type);
  return {
    board: createBoard(),
    active: makeActivePiece(type),
    score: 0,
    gravityElapsed: 0
  };
}

/**
 * Whether cells can occupy the board. This game keeps all active cells within
 * the visible board: cells above row zero are not legal placements.
 */
function canPlace(board, cells) {
  return cells.every(({ x, y }) =>
    Number.isInteger(x) && Number.isInteger(y) &&
    x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT &&
    !board[y]?.[x]
  );
}

function moveHorizontally(game, columns) {
  if (!Number.isInteger(columns) || columns === 0) {
    throw new RangeError("horizontal movement must be a non-zero whole number");
  }
  const cells = game.active.cells.map(({ x, y }) => ({ x: x + columns, y }));
  if (!canPlace(game.board, cells)) return game;

  return {
    ...game,
    active: { ...game.active, x: game.active.x + columns, cells }
  };
}

function moveLeft(game) {
  return moveHorizontally(game, -1);
}

function moveRight(game) {
  return moveHorizontally(game, 1);
}

/**
 * Settle the current legal active piece and create its successor. The caller
 * owns the injected source, so game state remains plain data and a lock draws
 * exactly one new piece. Line clearing and spawn validation intentionally
 * follow this transition in later rules.
 */
function lockActivePiece(game, pieceSource) {
  if (typeof pieceSource !== "function") {
    throw new TypeError("pieceSource must be a function when locking a piece");
  }
  if (!canPlace(game.board, game.active.cells)) {
    throw new RangeError("cannot lock an active piece in an invalid placement");
  }

  const board = game.board.map((row) => row.slice());
  for (const { x, y } of game.active.cells) board[y][x] = game.active.type;

  const nextType = pieceSource();
  assertPiece(nextType);
  return { ...game, board, active: makeActivePiece(nextType) };
}

/**
 * Move the active piece down one row. A blocked step locks immediately; there
 * is no lock delay. `pieceSource` is consulted only by that lock transition.
 */
function moveDown(game, pieceSource) {
  const cells = game.active.cells.map(({ x, y }) => ({ x, y: y + 1 }));
  if (!canPlace(game.board, cells)) return lockActivePiece(game, pieceSource);

  return {
    ...game,
    active: { ...game.active, y: game.active.y + 1, cells }
  };
}

/**
 * Apply elapsed time to gravity without relying on a clock. One call processes
 * at most MAX_GRAVITY_STEPS descents; elapsed time beyond that cap is dropped.
 * Locking ends the update and resets the accumulator, so a successor never
 * inherits time that belonged to the piece that just locked.
 */
function advanceGravity(game, elapsedMs, pieceSource) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new RangeError("elapsed time must be a non-negative finite number");
  }

  const previousElapsed = game.gravityElapsed ?? 0;
  const elapsed = Math.min(
    previousElapsed + elapsedMs,
    GRAVITY_INTERVAL_MS * MAX_GRAVITY_STEPS
  );
  let steps = Math.floor(elapsed / GRAVITY_INTERVAL_MS);
  let next = { ...game, gravityElapsed: elapsed % GRAVITY_INTERVAL_MS };

  while (steps > 0) {
    const descended = moveDown(next, pieceSource);
    // moveDown retains the board object for an ordinary descent and replaces it
    // only when it locks, making the transition explicit without extra state.
    if (descended.board !== next.board) return { ...descended, gravityElapsed: 0 };
    next = descended;
    steps -= 1;
  }

  return next;
}

/**
 * Rotate an active piece clockwise inside its current bounding box. Rotation
 * has no wall kicks: the piece keeps its x/y origin and the action is rejected
 * if that exact rotated footprint is outside the board or hits settled cells.
 */
function rotateClockwise(game) {
  const { active } = game;
  // The O piece deliberately has one rotation state. Its footprint never
  // changes, including when it is rotated four times.
  if (active.type === "O") {
    return {
      ...game,
      active: { ...active, cells: active.cells.map(({ x, y }) => ({ x, y })) }
    };
  }

  const localCells = active.cells.map(({ x, y }) => ({ x: x - active.x, y: y - active.y }));
  const height = Math.max(...localCells.map(({ y }) => y)) + 1;
  const cells = localCells.map(({ x, y }) => ({
    x: active.x + height - 1 - y,
    y: active.y + x
  }));

  if (!canPlace(game.board, cells)) return game;
  return {
    ...game,
    active: {
      ...active,
      rotation: (active.rotation + 1) % 4,
      cells
    }
  };
}

module.exports = {
  PIECES,
  PIECE_NAMES,
  GRAVITY_INTERVAL_MS,
  MAX_GRAVITY_STEPS,
  advanceGravity,
  canPlace,
  createBoard,
  createGame,
  createPieceSource,
  lockActivePiece,
  makeActivePiece,
  moveDown,
  moveHorizontally,
  moveLeft,
  moveRight,
  rotateClockwise
};
