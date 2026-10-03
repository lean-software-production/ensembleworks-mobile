'use strict';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const PIECE_TYPES = Object.freeze(['I', 'O', 'T', 'J', 'L', 'S', 'Z']);

const BASE_SHAPES = Object.freeze({
  I: { size: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  O: { size: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { size: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  J: { size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
  S: { size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
});

function rotateCells(cells, size) {
  return cells.map(([x, y]) => [size - 1 - y, x]);
}

function buildRotations({ cells, size }) {
  const rotations = [cells];
  for (let rotation = 1; rotation < 4; rotation += 1) {
    rotations.push(rotateCells(rotations[rotation - 1], size));
  }
  return Object.freeze(rotations.map((shape) => Object.freeze(
    shape.map((cell) => Object.freeze(cell)),
  )));
}

const TETROMINOES = Object.freeze(Object.fromEntries(
  Object.entries(BASE_SHAPES).map(([type, definition]) => [type, Object.freeze({
    size: definition.size,
    rotations: buildRotations(definition),
  })]),
));

function emptyRow(width) {
  return Array(width).fill(null);
}

class TetrisGame {
  constructor({
    width = BOARD_WIDTH,
    height = BOARD_HEIGHT,
    random = Math.random,
    autoStart = true,
  } = {}) {
    if (!Number.isInteger(width) || width < 4) {
      throw new RangeError('Board width must be an integer of at least 4');
    }
    if (!Number.isInteger(height) || height < 4) {
      throw new RangeError('Board height must be an integer of at least 4');
    }
    if (typeof random !== 'function') {
      throw new TypeError('random must be a function');
    }

    this.width = width;
    this.height = height;
    this.random = random;
    this.reset(autoStart);
  }

  reset(autoStart = true) {
    this.board = Array.from({ length: this.height }, () => emptyRow(this.width));
    this.activePiece = null;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.gameOver = false;
    this.bag = [];

    if (autoStart) this.spawnPiece();
  }

  refillBag() {
    this.bag = [...PIECE_TYPES];
    for (let index = this.bag.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(this.random() * (index + 1));
      [this.bag[index], this.bag[swapIndex]] = [this.bag[swapIndex], this.bag[index]];
    }
  }

  nextPieceType() {
    if (this.bag.length === 0) this.refillBag();
    return this.bag.pop();
  }

  spawnPiece(type = this.nextPieceType()) {
    if (!TETROMINOES[type]) throw new RangeError(`Unknown tetromino: ${type}`);
    if (this.gameOver) return false;

    const { size } = TETROMINOES[type];
    const piece = {
      type,
      rotation: 0,
      x: Math.floor((this.width - size) / 2),
      y: 0,
    };

    if (!this.canPlace(piece)) {
      this.activePiece = null;
      this.gameOver = true;
      return false;
    }

    this.activePiece = piece;
    return true;
  }

  cellsFor(piece = this.activePiece) {
    if (!piece) return [];
    const definition = TETROMINOES[piece.type];
    if (!definition) throw new RangeError(`Unknown tetromino: ${piece.type}`);
    const rotation = ((piece.rotation % 4) + 4) % 4;
    return definition.rotations[rotation].map(([x, y]) => [piece.x + x, piece.y + y]);
  }

  canPlace(piece = this.activePiece) {
    if (!piece) return false;
    return this.cellsFor(piece).every(([x, y]) => (
      x >= 0
      && x < this.width
      && y < this.height
      && (y < 0 || this.board[y][x] === null)
    ));
  }

  tryMove(deltaX, deltaY) {
    if (!this.activePiece || this.gameOver) return false;
    const candidate = {
      ...this.activePiece,
      x: this.activePiece.x + deltaX,
      y: this.activePiece.y + deltaY,
    };
    if (!this.canPlace(candidate)) return false;
    this.activePiece = candidate;
    return true;
  }

  moveLeft() {
    return this.tryMove(-1, 0);
  }

  moveRight() {
    return this.tryMove(1, 0);
  }

  moveDown() {
    if (this.tryMove(0, 1)) return true;
    if (this.activePiece && !this.gameOver) this.lockPiece();
    return false;
  }

  tick() {
    return this.moveDown();
  }

  rotate(direction = 1) {
    if (!this.activePiece || this.gameOver) return false;
    const nextRotation = (this.activePiece.rotation + (direction < 0 ? 3 : 1)) % 4;
    const kicks = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]];

    for (const [deltaX, deltaY] of kicks) {
      const candidate = {
        ...this.activePiece,
        rotation: nextRotation,
        x: this.activePiece.x + deltaX,
        y: this.activePiece.y + deltaY,
      };
      if (this.canPlace(candidate)) {
        this.activePiece = candidate;
        return true;
      }
    }
    return false;
  }

  hardDrop() {
    if (!this.activePiece || this.gameOver) return 0;
    let distance = 0;
    while (this.tryMove(0, 1)) distance += 1;
    this.score += distance * 2;
    this.lockPiece();
    return distance;
  }

  lockPiece() {
    if (!this.activePiece || this.gameOver) return false;

    const cells = this.cellsFor();
    if (cells.some(([, y]) => y < 0)) {
      this.activePiece = null;
      this.gameOver = true;
      return false;
    }

    for (const [x, y] of cells) this.board[y][x] = this.activePiece.type;

    this.activePiece = null;
    const cleared = this.clearLines();
    const lineScores = [0, 100, 300, 500, 800];
    this.score += lineScores[cleared] * this.level;
    this.lines += cleared;
    this.level = Math.floor(this.lines / 10) + 1;
    this.spawnPiece();
    return true;
  }

  clearLines() {
    const remainingRows = this.board.filter((row) => row.some((cell) => cell === null));
    const cleared = this.height - remainingRows.length;
    this.board = [
      ...Array.from({ length: cleared }, () => emptyRow(this.width)),
      ...remainingRows,
    ];
    return cleared;
  }
}

module.exports = {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  PIECE_TYPES,
  TETROMINOES,
  TetrisGame,
};
