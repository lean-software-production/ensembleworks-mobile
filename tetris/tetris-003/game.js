const WIDTH = 10;
const HEIGHT = 20;

const SHAPES = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
};

function createBoard() {
  return Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(0));
}

function createPiece(type, x = Math.floor((WIDTH - SHAPES[type][0].length) / 2), y = 0) {
  if (!SHAPES[type]) throw new Error(`Unknown piece: ${type}`);
  return { type, matrix: SHAPES[type].map(row => row.slice()), x, y };
}

function collides(board, piece, dx = 0, dy = 0, matrix = piece.matrix) {
  for (let row = 0; row < matrix.length; row++) {
    for (let col = 0; col < matrix[row].length; col++) {
      if (!matrix[row][col]) continue;
      const x = piece.x + dx + col;
      const y = piece.y + dy + row;
      if (x < 0 || x >= WIDTH || y >= HEIGHT) return true;
      if (y >= 0 && board[y][x]) return true;
    }
  }
  return false;
}

function movePiece(board, piece, dx, dy) {
  if (collides(board, piece, dx, dy)) return false;
  piece.x += dx;
  piece.y += dy;
  return true;
}

function rotateMatrix(matrix, clockwise = true) {
  const height = matrix.length;
  const width = matrix[0].length;
  return clockwise
    ? Array.from({ length: width }, (_, x) => Array.from({ length: height }, (_, y) => matrix[height - 1 - y][x]))
    : Array.from({ length: width }, (_, x) => Array.from({ length: height }, (_, y) => matrix[y][width - 1 - x]));
}

function rotatePiece(board, piece, clockwise = true) {
  const rotated = rotateMatrix(piece.matrix, clockwise);
  // Simple wall kicks allow rotation near either side without permitting overlap.
  for (const kick of [0, -1, 1, -2, 2]) {
    if (!collides(board, piece, kick, 0, rotated)) {
      piece.x += kick;
      piece.matrix = rotated;
      return true;
    }
  }
  return false;
}

function lockPiece(board, piece) {
  for (let row = 0; row < piece.matrix.length; row++) {
    for (let col = 0; col < piece.matrix[row].length; col++) {
      if (!piece.matrix[row][col]) continue;
      const x = piece.x + col;
      const y = piece.y + row;
      if (y < 0) return false;
      board[y][x] = piece.type;
    }
  }
  return true;
}

function clearLines(board) {
  let cleared = 0;
  for (let y = board.length - 1; y >= 0; y--) {
    if (board[y].every(Boolean)) {
      board.splice(y, 1);
      board.unshift(Array(WIDTH).fill(0));
      cleared++;
      y++;
    }
  }
  return cleared;
}

module.exports = {
  WIDTH, HEIGHT, SHAPES, createBoard, createPiece, collides, movePiece,
  rotateMatrix, rotatePiece, lockPiece, clearLines,
};
