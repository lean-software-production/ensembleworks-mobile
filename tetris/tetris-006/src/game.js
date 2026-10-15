'use strict';

const { BOARD_HEIGHT, BOARD_WIDTH, emptyBoard, validateBoard } = require('./render');

const PIECE_TYPES = Object.freeze(['I', 'O', 'T', 'S', 'Z', 'J', 'L']);
// Points awarded for clearing 0, 1, 2, 3, or 4 lines with one locked piece.
const SCORE_BY_LINES = Object.freeze([0, 100, 300, 500, 800]);

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
  if (!game || (!game.activePiece && !game.gameOver)) {
    throw new TypeError('game must have an activePiece');
  }
  if (game.gameOver) return false;
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
 * Move the active piece down one row without locking it. Returns false when
 * the floor or a settled block prevents the step, leaving all game state
 * unchanged; locking and piece progression are separate actions.
 */
function moveDown(game) {
  if (!game || (!game.activePiece && !game.gameOver)) {
    throw new TypeError('game must have an activePiece');
  }
  if (game.gameOver) return false;

  const candidate = { ...game.activePiece, y: game.activePiece.y + 1 };
  if (!canPlace(game.board, candidate)) return false;

  game.activePiece = candidate;
  return true;
}

/** Return the fixed score awarded for a single lock's cleared-line count. */
function pointsForLines(linesCleared) {
  if (!Number.isInteger(linesCleared) || linesCleared < 0) {
    throw new RangeError('linesCleared must be a non-negative integer');
  }
  return SCORE_BY_LINES[linesCleared] || 0;
}

/**
 * Remove every full row and prepend the same number of empty rows. This
 * mutates the supplied board and returns how many completed lines it removed.
 */
function clearCompletedLines(board) {
  validateBoard(board);

  const remainingRows = board.filter((row) => !row.every(Boolean));
  const cleared = BOARD_HEIGHT - remainingRows.length;
  if (cleared > 0) {
    board.splice(0, BOARD_HEIGHT, ...emptyBoard().slice(0, cleared), ...remainingRows);
  }
  return cleared;
}

/** Copy a valid active piece into the settled board without spawning another. */
function lockPiece(game) {
  if (!game || !game.activePiece) {
    throw new TypeError('game must have an activePiece');
  }
  if (!canPlace(game.board, game.activePiece)) {
    throw new RangeError('Active piece cannot be locked outside or into the board');
  }

  for (const { x, y } of activeCells(game.activePiece)) {
    game.board[y][x] = true;
  }
}

/**
 * Advance a game by one gravity/soft-drop step. A successful step moves only;
 * a blocked step locks, clears completed lines, then consumes one source
 * piece. The result reports the cleared-line count for later scoring. If that
 * piece cannot spawn after clearing, no overlapping active piece is installed
 * and the game enters its terminal game-over state.
 */
function advanceGame(game) {
  if (!game || !game.pieceSource || typeof game.pieceSource.nextType !== 'function'
    || (!game.activePiece && !game.gameOver)) {
    throw new TypeError('game must have an activePiece and pieceSource');
  }
  if (game.gameOver) {
    return {
      moved: false, locked: false, spawned: false, spawnBlocked: false, linesCleared: 0, gameOver: true,
    };
  }

  if (moveDown(game)) {
    return {
      moved: true, locked: false, spawned: false, spawnBlocked: false, linesCleared: 0,
    };
  }

  lockPiece(game);
  const linesCleared = clearCompletedLines(game.board);
  game.score += pointsForLines(linesCleared);
  const nextPiece = spawnPiece(game.pieceSource.nextType());
  if (!canPlace(game.board, nextPiece)) {
    game.activePiece = null;
    game.gameOver = true;
    return {
      moved: false, locked: true, spawned: false, spawnBlocked: true, linesCleared,
    };
  }

  game.activePiece = nextPiece;
  return {
    moved: false, locked: true, spawned: true, spawnBlocked: false, linesCleared,
  };
}

/**
 * Rotate clockwise in the active shape's bounding box: (x, y) becomes
 * (height - 1 - y, x). No wall kicks are applied; an out-of-bounds or
 * settled-cell collision rejects the rotation and leaves the piece intact.
 */
function rotateClockwise(game) {
  if (!game || (!game.activePiece && !game.gameOver)) {
    throw new TypeError('game must have an activePiece');
  }
  if (game.gameOver) return false;

  const cells = game.activePiece.cells;
  const height = Math.max(...cells.map((cell) => cell.y)) + 1;
  const rotated = cells.map(({ x, y }) => ({ x: height - 1 - y, y: x }));
  const minX = Math.min(...rotated.map((cell) => cell.x));
  const minY = Math.min(...rotated.map((cell) => cell.y));
  const candidate = {
    ...game.activePiece,
    cells: rotated.map((cell) => ({ x: cell.x - minX, y: cell.y - minY })),
  };
  if (!canPlace(game.board, candidate)) return false;

  game.activePiece = candidate;
  return true;
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

/**
 * Reset a game in place, retaining its configured piece source while replacing
 * the board, score, active piece, and terminal status with a fresh game.
 */
function restartGame(game) {
  if (!game || !game.pieceSource || typeof game.pieceSource.nextType !== 'function') {
    throw new TypeError('game must have a pieceSource');
  }

  game.board = emptyBoard();
  game.score = 0;
  game.activePiece = spawnPiece(game.pieceSource.nextType());
  game.gameOver = false;
  return game;
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

  return {
    board, score: 0, activePiece, pieceSource, gameOver: false,
  };
}

module.exports = {
  PIECE_TYPES,
  SCORE_BY_LINES,
  TETROMINOES,
  activeCells,
  canPlace,
  clearCompletedLines,
  createGame,
  createPieceSource,
  moveHorizontally,
  moveLeft,
  moveRight,
  moveDown,
  lockPiece,
  pointsForLines,
  advanceGame,
  rotateClockwise,
  restartGame,
  spawnPiece,
};
