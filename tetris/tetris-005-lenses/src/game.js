'use strict';

const PIECES = Object.freeze({
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
  O: [[1, 0], [2, 0], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
});

const PIECE_NAMES = Object.freeze(Object.keys(PIECES));
const LINE_SCORES = Object.freeze([0, 100, 300, 500, 800]);

function emptyBoard(width, height) {
  return Array.from({ length: height }, () => Array(width).fill(null));
}

function rotateClockwise(cells) {
  // Rotate in a 4 by 4 bounding box, as used by the SRS tetromino grid.
  return cells.map(([x, y]) => [3 - y, x]);
}

function makePiece(type) {
  if (!PIECES[type]) throw new Error(`Unknown tetromino: ${type}`);
  return { type, cells: PIECES[type].map(([x, y]) => [x, y]), x: 3, y: 0 };
}

class TetrisGame {
  constructor({ width = 10, height = 20, random = Math.random } = {}) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 4 || height < 4) {
      throw new Error('Board dimensions must be integers of at least 4');
    }
    this.width = width;
    this.height = height;
    this.random = random;
    this.board = emptyBoard(width, height);
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.gameOver = false;
    this.bag = [];
    this.current = null;
    this.nextType = this.takeType();
    this.spawn();
  }

  takeType() {
    if (this.bag.length === 0) {
      this.bag = PIECE_NAMES.slice();
      for (let i = this.bag.length - 1; i > 0; i -= 1) {
        const j = Math.floor(this.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    return this.bag.pop();
  }

  spawn() {
    if (this.gameOver) return false;
    this.current = makePiece(this.nextType);
    this.current.x = Math.floor((this.width - 4) / 2);
    this.nextType = this.takeType();
    if (this.collides(this.current)) {
      this.gameOver = true;
      return false;
    }
    return true;
  }

  cellsFor(piece = this.current) {
    return piece.cells.map(([x, y]) => [piece.x + x, piece.y + y]);
  }

  collides(piece) {
    return this.cellsFor(piece).some(([x, y]) => (
      x < 0 || x >= this.width || y >= this.height || (y >= 0 && this.board[y][x] !== null)
    ));
  }

  move(dx, dy) {
    if (this.gameOver || !this.current) return false;
    const candidate = { ...this.current, x: this.current.x + dx, y: this.current.y + dy };
    if (this.collides(candidate)) return false;
    this.current = candidate;
    return true;
  }

  rotate() {
    if (this.gameOver || !this.current || this.current.type === 'O') return false;
    const candidate = { ...this.current, cells: rotateClockwise(this.current.cells) };
    // Small wall kicks make rotations at either side of the board usable.
    for (const kick of [0, -1, 1, -2, 2]) {
      const kicked = { ...candidate, x: candidate.x + kick };
      if (!this.collides(kicked)) {
        this.current = kicked;
        return true;
      }
    }
    return false;
  }

  tick() {
    if (this.gameOver) return false;
    if (this.move(0, 1)) return true;
    this.lock();
    return false;
  }

  softDrop() {
    if (this.move(0, 1)) {
      this.score += 1;
      return true;
    }
    this.lock();
    return false;
  }

  hardDrop() {
    if (this.gameOver) return 0;
    let distance = 0;
    while (this.move(0, 1)) distance += 1;
    this.score += distance * 2;
    this.lock();
    return distance;
  }

  lock() {
    if (this.gameOver || !this.current) return;
    for (const [x, y] of this.cellsFor()) {
      if (y < 0) {
        this.gameOver = true;
        return;
      }
      this.board[y][x] = this.current.type;
    }
    const cleared = this.clearLines();
    if (cleared > 0) {
      this.lines += cleared;
      this.score += LINE_SCORES[cleared] * this.level;
      this.level = Math.floor(this.lines / 10) + 1;
    }
    this.spawn();
  }

  clearLines() {
    const remaining = this.board.filter((row) => row.some((cell) => cell === null));
    const count = this.height - remaining.length;
    while (remaining.length < this.height) remaining.unshift(Array(this.width).fill(null));
    this.board = remaining;
    return count;
  }
}

module.exports = { TetrisGame, PIECES, LINE_SCORES };
