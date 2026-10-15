'use strict';

const WIDTH = 10;
const HEIGHT = 18;

const SHAPES = [
  { name: 'I', cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  { name: 'J', cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  { name: 'L', cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
  { name: 'O', cells: [[1, 0], [2, 0], [1, 1], [2, 1]] },
  { name: 'S', cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  { name: 'T', cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  { name: 'Z', cells: [[0, 0], [1, 0], [1, 1], [2, 1]] }
];

function rotate(cells) {
  return cells.map(([x, y]) => [3 - y, x]);
}

class TetrisGame {
  constructor(random = Math.random) {
    this.random = random;
    this.board = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(null));
    this.score = 0;
    this.lines = 0;
    this.over = false;
    this.current = null;
    this.spawn();
  }

  makePiece() {
    const shape = SHAPES[Math.floor(this.random() * SHAPES.length)];
    return { name: shape.name, cells: shape.cells.map(cell => [...cell]), x: 3, y: 0 };
  }

  spawn() {
    this.current = this.makePiece();
    if (this.collides(this.current)) this.over = true;
  }

  collides(piece) {
    return piece.cells.some(([dx, dy]) => {
      const x = piece.x + dx;
      const y = piece.y + dy;
      return x < 0 || x >= WIDTH || y >= HEIGHT || (y >= 0 && this.board[y][x]);
    });
  }

  move(dx, dy) {
    if (this.over) return false;
    const candidate = { ...this.current, x: this.current.x + dx, y: this.current.y + dy };
    if (this.collides(candidate)) return false;
    this.current = candidate;
    return true;
  }

  rotate() {
    if (this.over) return false;
    const cells = rotate(this.current.cells);
    // Small wall kicks make rotations at an edge usable without complex rotation rules.
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
    if (!this.move(0, 1) && !this.over) this.lock();
  }

  drop() {
    if (this.over) return;
    while (this.move(0, 1)) {}
    this.lock();
  }

  lock() {
    for (const [dx, dy] of this.current.cells) {
      const x = this.current.x + dx;
      const y = this.current.y + dy;
      if (y >= 0) this.board[y][x] = this.current.name;
    }
    this.clearLines();
    this.spawn();
  }

  clearLines() {
    let cleared = 0;
    this.board = this.board.filter(row => {
      if (row.every(Boolean)) {
        cleared += 1;
        return false;
      }
      return true;
    });
    while (this.board.length < HEIGHT) this.board.unshift(Array(WIDTH).fill(null));
    if (cleared) {
      this.lines += cleared;
      this.score += [0, 100, 300, 500, 800][cleared] * (1 + Math.floor(this.lines / 10));
    }
  }

  level() {
    return 1 + Math.floor(this.lines / 10);
  }

  cells() {
    const view = this.board.map(row => [...row]);
    if (!this.over) {
      for (const [dx, dy] of this.current.cells) {
        const y = this.current.y + dy;
        if (y >= 0) view[y][this.current.x + dx] = this.current.name;
      }
    }
    return view;
  }
}

module.exports = { TetrisGame, WIDTH, HEIGHT, SHAPES };
