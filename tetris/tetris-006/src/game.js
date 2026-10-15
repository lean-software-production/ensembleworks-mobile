'use strict';

const { BOARD_HEIGHT, BOARD_WIDTH, emptyBoard, validateBoard } = require('./render');

const PIECE_TYPES = Object.freeze(['I', 'O', 'T', 'S', 'Z', 'J', 'L']);

// Coordinates are relative to each piece's top-left bounding box.
const TETROMINOES = Object.freeze({
  I: Object.freeze([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }]),
  O: Object.freeze([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]),
  T: Object.freeze([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }]),
  S: Object.freeze([{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]),
  Z: Object.freeze([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }]),
  J: Object.freeze([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }]),
  L: Object.freeze([{ x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }]),
});

function pieceWidth(type) {
  return Math.max(...TETROMINOES[type].map((cell) => cell.x)) + 1;
}

/** Return the four absolute board cells occupied by an active piece. */
function activeCells(piece) {
  return piece.cells.map((cell) => ({ x: piece.x + cell.x, y: piece.y + cell.y }));
}

/**
 * Create an active piece at the centered top spawn position. Pieces are
 * intentionally plain data so future movement actions can replace them.
 */
function spawnPiece(type) {
  if (!TETROMINOES[type]) {
    throw new RangeError(`Unknown tetromino type: ${type}`);
  }

  return {
    type,
    x: Math.floor((BOARD_WIDTH - pieceWidth(type)) / 2),
    y: 0,
    cells: TETROMINOES[type].map((cell) => ({ ...cell })),
  };
}

/** True when every cell is in bounds and unoccupied by settled blocks. */
function canPlace(board, piece) {
  validateBoard(board);
  return activeCells(piece).every(({ x, y }) =>
    x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT && !board[y][x],
  );
}

/** Move the active piece one column when its proposed placement is valid. */
function moveHorizontally(game, columns) {
  if (!game || !game.activePiece) {
    throw new TypeError('game must have an activePiece');
  }
  if (columns !== -1 && columns !== 1) {
    throw new RangeError('horizontal movement must be one column left or right');
  }

  const candidate = { ...game.activePiece, x: game.activePiece.x + columns };
  if (!canPlace(game.board, candidate)) return false;

  game.activePiece = candidate;
  return true;
}

function moveLeft(game) {
  return moveHorizontally(game, -1);
}

function moveRight(game) {
  return moveHorizontally(game, 1);
}

/**
 * A deterministic pseudo-random source for reproducible games and tests.
 * Supplying a sequence makes it cycle forever; supplying random injects a
 * custom number generator returning values in [0, 1).
 */
function createPieceSource({ seed = 1, sequence, random } = {}) {
  if (sequence !== undefined) {
    if (!Array.isArray(sequence) || sequence.length === 0 || sequence.some((type) => !TETROMINOES[type])) {
      throw new RangeError('Piece sequence must contain known tetromino types');
    }
    let index = 0;
    return { nextType: () => sequence[index++ % sequence.length] };
  }

  let nextRandom = random;
  if (nextRandom === undefined) {
    let state = seed >>> 0;
    nextRandom = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    };
  }
  if (typeof nextRandom !== 'function') {
    throw new TypeError('random must be a function');
  }

  return {
    nextType: () => {
      const value = nextRandom();
      if (!Number.isFinite(value) || value < 0 || value >= 1) {
        throw new RangeError('random must return a number in [0, 1)');
      }
      return PIECE_TYPES[Math.floor(value * PIECE_TYPES.length)];
    },
  };
}

/** Create a fresh game state with a valid, centered active tetromino. */
function createGame({ board = emptyBoard(), pieceSource = createPieceSource() } = {}) {
  validateBoard(board);
  if (!pieceSource || typeof pieceSource.nextType !== 'function') {
    throw new TypeError('pieceSource must provide nextType()');
  }

  const activePiece = spawnPiece(pieceSource.nextType());
  if (!canPlace(board, activePiece)) {
    throw new RangeError('Initial piece cannot be placed on the board');
  }

  return { board, score: 0, activePiece, pieceSource };
}

module.exports = {
  PIECE_TYPES,
  TETROMINOES,
  activeCells,
  canPlace,
  createGame,
  createPieceSource,
  moveHorizontally,
  moveLeft,
  moveRight,
  spawnPiece,
};
