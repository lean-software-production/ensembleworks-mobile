'use strict';

const SHAPES = Object.freeze({
  I: [[1, 1, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
  O: [[1, 1], [1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  T: [[0, 1, 0], [1, 1, 1]],
  Z: [[1, 1, 0], [0, 1, 1]]
});

const SYMBOLS = Object.freeze({ I: 'I', J: 'J', L: 'L', O: 'O', S: 'S', T: 'T', Z: 'Z' });

function cloneMatrix(matrix) {
  return matrix.map((row) => row.slice());
}

function rotateClockwise(matrix) {
  const height = matrix.length;
  const width = matrix[0].length;
  return Array.from({ length: width }, (_, y) =>
    Array.from({ length: height }, (_, x) => matrix[height - 1 - x][y])
  );
}

class Piece {
  #symbol;
  #matrix;
  #x;
  #y;

  constructor(symbol, matrix, x = 0, y = 0) {
    this.#symbol = symbol;
    this.#matrix = cloneMatrix(matrix);
    this.#x = x;
    this.#y = y;
  }

  centeredIn(width) {
    return new Piece(
      this.#symbol,
      this.#matrix,
      Math.floor((width - this.#matrix[0].length) / 2),
      this.#y
    );
  }

  moved(dx, dy) {
    return new Piece(this.#symbol, this.#matrix, this.#x + dx, this.#y + dy);
  }

  rotated() {
    return new Piece(this.#symbol, rotateClockwise(this.#matrix), this.#x, this.#y);
  }

  occupiedCells() {
    const cells = [];
    this.#matrix.forEach((row, y) => row.forEach((occupied, x) => {
      if (occupied) {
        cells.push({ x: this.#x + x, y: this.#y + y, symbol: this.#symbol });
      }
    }));
    return cells;
  }
}

class PieceSource {
  constructor(random = Math.random) {
    this.random = random;
    this.bag = [];
  }

  next() {
    if (this.bag.length === 0) {
      this.bag = Object.keys(SHAPES);
      for (let i = this.bag.length - 1; i > 0; i -= 1) {
        const j = Math.floor(this.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }

    const type = this.bag.pop();
    return new Piece(SYMBOLS[type], SHAPES[type]);
  }
}

module.exports = { Piece, PieceSource };
