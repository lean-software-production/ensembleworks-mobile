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
  return { board: createBoard(), active: makeActivePiece(type), score: 0 };
}

module.exports = {
  PIECES,
  PIECE_NAMES,
  createBoard,
  createGame,
  createPieceSource,
  makeActivePiece
};
