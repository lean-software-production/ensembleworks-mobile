const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 18;

const PIECES = [
  { name: 'I', colour: 'cyan', shape: [[1, 1, 1, 1]] },
  { name: 'O', colour: 'yellow', shape: [[1, 1], [1, 1]] },
  { name: 'T', colour: 'magenta', shape: [[0, 1, 0], [1, 1, 1]] },
  { name: 'S', colour: 'green', shape: [[0, 1, 1], [1, 1, 0]] },
  { name: 'Z', colour: 'red', shape: [[1, 1, 0], [0, 1, 1]] },
  { name: 'J', colour: 'blue', shape: [[1, 0, 0], [1, 1, 1]] },
  { name: 'L', colour: 'yellow', shape: [[0, 0, 1], [1, 1, 1]] },
];

function rotate(shape) {
  return shape[0].map((_, x) => shape.map(row => row[x]).reverse());
}

function newPiece(random = Math.random) {
  const definition = PIECES[Math.floor(random() * PIECES.length)];
  return {
    ...definition,
    shape: definition.shape.map(row => [...row]),
    x: Math.floor((BOARD_WIDTH - definition.shape[0].length) / 2),
    y: 0,
  };
}

function createGame(random = Math.random) {
  const game = {
    board: Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null)),
    score: 0,
    lines: 0,
    status: 'Playing',
    random,
    piece: null,
  };
  spawn(game);
  return game;
}

function collides(game, piece, x = piece.x, y = piece.y, shape = piece.shape) {
  return shape.some((row, rowIndex) => row.some((filled, columnIndex) => {
    if (!filled) return false;
    const boardX = x + columnIndex;
    const boardY = y + rowIndex;
    return boardX < 0 || boardX >= BOARD_WIDTH || boardY >= BOARD_HEIGHT ||
      (boardY >= 0 && game.board[boardY][boardX]);
  }));
}

function spawn(game) {
  const piece = newPiece(game.random);
  if (collides(game, piece)) {
    game.piece = null;
    game.status = 'Game over';
    return false;
  }
  game.piece = piece;
  return true;
}

function move(game, horizontal, vertical = 0) {
  if (game.status !== 'Playing' || !game.piece) return false;
  const { piece } = game;
  if (collides(game, piece, piece.x + horizontal, piece.y + vertical)) return false;
  piece.x += horizontal;
  piece.y += vertical;
  return true;
}

function turn(game) {
  if (game.status !== 'Playing' || !game.piece) return false;
  const rotated = rotate(game.piece.shape);
  for (const kick of [0, -1, 1, -2, 2]) {
    if (!collides(game, game.piece, game.piece.x + kick, game.piece.y, rotated)) {
      game.piece.shape = rotated;
      game.piece.x += kick;
      return true;
    }
  }
  return false;
}

function clearLines(game) {
  let cleared = 0;
  game.board = game.board.filter(row => {
    if (row.every(Boolean)) {
      cleared += 1;
      return false;
    }
    return true;
  });
  while (game.board.length < BOARD_HEIGHT) game.board.unshift(Array(BOARD_WIDTH).fill(null));
  if (cleared) {
    game.lines += cleared;
    game.score += [0, 100, 300, 500, 800][cleared];
  }
  return cleared;
}

function lock(game) {
  const { piece } = game;
  piece.shape.forEach((row, rowIndex) => row.forEach((filled, columnIndex) => {
    if (filled && piece.y + rowIndex >= 0) game.board[piece.y + rowIndex][piece.x + columnIndex] = piece.colour;
  }));
  clearLines(game);
  spawn(game);
}

function tick(game) {
  if (game.status !== 'Playing') return false;
  if (!move(game, 0, 1)) lock(game);
  return true;
}

function drop(game) {
  if (game.status !== 'Playing') return false;
  while (move(game, 0, 1));
  lock(game);
  return true;
}

module.exports = { BOARD_WIDTH, BOARD_HEIGHT, PIECES, createGame, collides, move, turn, tick, drop, clearLines };
