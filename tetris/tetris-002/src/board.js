'use strict';

class Board {
  constructor(width = 10, height = 20) {
    this.width = width;
    this.height = height;
    this.reset();
  }

  reset() {
    this.cells = Array.from({ length: this.height }, () => Array(this.width).fill(null));
  }

  canPlace(piece) {
    return piece.occupiedCells().every(({ x, y }) => {
      if (x < 0 || x >= this.width || y >= this.height) return false;
      return y < 0 || !this.cells[y][x];
    });
  }

  place(piece) {
    let aboveBoard = false;
    piece.occupiedCells().forEach(({ x, y, symbol }) => {
      if (y < 0) {
        aboveBoard = true;
      } else {
        this.cells[y][x] = symbol;
      }
    });
    return aboveBoard;
  }

  clearLines() {
    const remaining = this.cells.filter((row) => row.some((cell) => !cell));
    const cleared = this.height - remaining.length;
    const emptyRows = Array.from({ length: cleared }, () => Array(this.width).fill(null));
    this.cells = emptyRows.concat(remaining);
    return cleared;
  }

  snapshot(activePiece = null) {
    const view = this.cells.map((row) => row.slice());
    if (!activePiece) return view;

    activePiece.occupiedCells().forEach(({ x, y, symbol }) => {
      if (y >= 0 && y < this.height) view[y][x] = symbol;
    });
    return view;
  }
}

module.exports = { Board };
