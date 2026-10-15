'use strict';

const PIECES = Object.freeze({
  I: Object.freeze([[0, 1], [1, 1], [2, 1], [3, 1]]),
  J: Object.freeze([[0, 0], [0, 1], [1, 1], [2, 1]]),
  L: Object.freeze([[2, 0], [0, 1], [1, 1], [2, 1]]),
  O: Object.freeze([[0, 0], [1, 0], [0, 1], [1, 1]]),
  S: Object.freeze([[1, 0], [2, 0], [0, 1], [1, 1]]),
  T: Object.freeze([[1, 0], [0, 1], [1, 1], [2, 1]]),
  Z: Object.freeze([[0, 0], [1, 0], [1, 1], [2, 1]])
});
const PIECE_NAMES = Object.freeze(Object.keys(PIECES));
const LINE_SCORES = Object.freeze([0, 100, 300, 500, 800]);

function copyCells(cells) {
  return cells.map(([x, y]) => [x, y]);
}

function normalize(cells) {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return cells.map(([x, y]) => [x - minX, y - minY]);
}

function rotateCells(cells) {
  const maxY = Math.max(...cells.map(([, y]) => y));
  return normalize(cells.map(([x, y]) => [maxY - y, x]));
}

class TetrisGame {
  constructor({ width = 10, height = 20, random = Math.random } = {}) {
    if (!Number.isInteger(width) || width < 4 || !Number.isInteger(height) || height < 4) {
      throw new RangeError('The board must be at least 4 cells wide and high.');
    }
    if (typeof random !== 'function') throw new TypeError('random must be a function.');

    this.width = width;
    this.height = height;
    this.random = random;
    this.board = this.emptyBoard();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.gameOver = false;
    this.current = null;
    this.nextType = this.randomType();
    this.spawn();
  }

  emptyBoard() {
    return Array.from({ length: this.height }, () => Array(this.width).fill(null));
  }

  randomType() {
    const index = Math.floor(this.random() * PIECE_NAMES.length);
    return PIECE_NAMES[Math.max(0, Math.min(PIECE_NAMES.length - 1, index))];
  }

  makePiece(type) {
    const cells = copyCells(PIECES[type]);
    const pieceWidth = Math.max(...cells.map(([x]) => x)) + 1;
    return { type, cells, x: Math.floor((this.width - pieceWidth) / 2), y: 0 };
  }

  spawn() {
    if (this.gameOver) return false;
    this.current = this.makePiece(this.nextType);
    this.nextType = this.randomType();
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
    return this.cellsFor(piece).some(([x, y]) =>
      x < 0 || x >= this.width || y >= this.height || (y >= 0 && this.board[y][x] !== null)
    );
  }

  tryMove(dx, dy) {
    if (this.gameOver || !this.current) return false;
    const candidate = { ...this.current, x: this.current.x + dx, y: this.current.y + dy };
    if (this.collides(candidate)) return false;
    this.current = candidate;
    return true;
  }

  moveLeft() { return this.tryMove(-1, 0); }
  moveRight() { return this.tryMove(1, 0); }
  softDrop() { return this.tryMove(0, 1); }

  rotate() {
    if (this.gameOver || !this.current || this.current.type === 'O') return false;
    const cells = rotateCells(this.current.cells);
    // Small horizontal kicks let rotations succeed beside either wall.
    for (const kick of [0, -1, 1, -2, 2]) {
      const candidate = { ...this.current, cells, x: this.current.x + kick };
      if (!this.collides(candidate)) {
        this.current = candidate;
        return true;
      }
    }
    return false;
  }

  tick() {
    if (this.gameOver) return false;
    if (this.softDrop()) return true;
    this.lockCurrent();
    this.clearLines();
    return this.spawn();
  }

  hardDrop() {
    if (this.gameOver) return 0;
    let distance = 0;
    while (this.softDrop()) distance += 1;
    this.score += distance * 2;
    this.lockCurrent();
    this.clearLines();
    this.spawn();
    return distance;
  }

  lockCurrent() {
    for (const [x, y] of this.cellsFor()) {
      if (y < 0) {
        this.gameOver = true;
      } else {
        this.board[y][x] = this.current.type;
      }
    }
  }

  clearLines() {
    const remaining = this.board.filter((row) => row.some((cell) => cell === null));
    const cleared = this.height - remaining.length;
    while (remaining.length < this.height) remaining.unshift(Array(this.width).fill(null));
    this.board = remaining;
    if (cleared > 0) {
      this.lines += cleared;
      this.level = Math.floor(this.lines / 10) + 1;
      this.score += LINE_SCORES[cleared] * this.level;
    }
    return cleared;
  }

  snapshot() {
    return {
      width: this.width,
      height: this.height,
      board: this.board.map((row) => [...row]),
      current: this.current && { ...this.current, cells: copyCells(this.current.cells) },
      nextType: this.nextType,
      score: this.score,
      lines: this.lines,
      level: this.level,
      gameOver: this.gameOver
    };
  }
}

module.exports = { TetrisGame, PIECES, LINE_SCORES };
