'use strict';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

// Each piece is described in its four rotation states. Coordinates are relative
// to the piece origin, which keeps collision and rendering independent.
const PIECES = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  O: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
};

const TYPES = Object.keys(PIECES);
const LINE_SCORES = [0, 100, 300, 500, 800];

class TetrisGame {
  constructor({ width = BOARD_WIDTH, height = BOARD_HEIGHT, random = Math.random } = {}) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 4 || height < 4) {
      throw new RangeError('The board must be at least 4 columns by 4 rows.');
    }

    this.width = width;
    this.height = height;
    this.random = random;
    this.reset();
  }

  reset() {
    this.board = Array.from({ length: this.height }, () => Array(this.width).fill(null));
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.gameOver = false;
    this.active = null;
    this.spawn();
  }

  cells(piece = this.active) {
    if (!piece) return [];
    return PIECES[piece.type][piece.rotation].map(([x, y]) => ({ x: piece.x + x, y: piece.y + y }));
  }

  collides(piece) {
    return this.cells(piece).some(({ x, y }) => (
      x < 0 || x >= this.width || y >= this.height || (y >= 0 && this.board[y][x] !== null)
    ));
  }

  spawn(type = this.nextType()) {
    if (this.gameOver) return false;
    const piece = { type, rotation: 0, x: Math.floor((this.width - 4) / 2), y: 0 };
    if (this.collides(piece)) {
      this.active = null;
      this.gameOver = true;
      return false;
    }
    this.active = piece;
    return true;
  }

  nextType() {
    return TYPES[Math.floor(this.random() * TYPES.length)];
  }

  move(dx, dy = 0) {
    if (this.gameOver || !this.active) return false;
    const candidate = { ...this.active, x: this.active.x + dx, y: this.active.y + dy };
    if (this.collides(candidate)) return false;
    this.active = candidate;
    return true;
  }

  rotate(direction = 1) {
    if (this.gameOver || !this.active) return false;
    const rotation = (this.active.rotation + direction + 4) % 4;
    // Small kicks allow rotations next to a wall without permitting overlaps.
    for (const dx of [0, -1, 1, -2, 2]) {
      const candidate = { ...this.active, rotation, x: this.active.x + dx };
      if (!this.collides(candidate)) {
        this.active = candidate;
        return true;
      }
    }
    return false;
  }

  tick() {
    if (this.gameOver) return false;
    if (this.move(0, 1)) return true;
    this.lock();
    return !this.gameOver;
  }

  hardDrop() {
    if (this.gameOver || !this.active) return 0;
    let distance = 0;
    while (this.move(0, 1)) distance += 1;
    this.score += distance * 2;
    this.lock();
    return distance;
  }

  lock() {
    if (this.gameOver || !this.active) return;
    for (const { x, y } of this.cells()) {
      // A piece that locks above the visible board ends the game.
      if (y < 0) {
        this.gameOver = true;
        this.active = null;
        return;
      }
      this.board[y][x] = this.active.type;
    }
    this.active = null;
    const cleared = this.clearLines();
    if (cleared) {
      this.score += LINE_SCORES[cleared] * this.level;
      this.lines += cleared;
      this.level = Math.floor(this.lines / 10) + 1;
    }
    this.spawn();
  }

  clearLines() {
    const remaining = this.board.filter((row) => row.some((cell) => cell === null));
    const cleared = this.height - remaining.length;
    while (remaining.length < this.height) remaining.unshift(Array(this.width).fill(null));
    this.board = remaining;
    return cleared;
  }
}

module.exports = { TetrisGame, BOARD_WIDTH, BOARD_HEIGHT, PIECES, LINE_SCORES };
