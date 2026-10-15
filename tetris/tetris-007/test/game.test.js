const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  createGame,
  move,
  turn,
  tick,
  drop,
  clearLines,
} = require('../src/game');

const pieceAt = index => () => index / 7;

test('spawns a tetromino centered on an empty board', () => {
  const game = createGame(pieceAt(0));

  assert.equal(game.board.length, BOARD_HEIGHT);
  assert.ok(game.board.every(row => row.length === BOARD_WIDTH && row.every(cell => cell === null)));
  assert.equal(game.piece.name, 'I');
  assert.equal(game.piece.x, 3);
  assert.equal(game.status, 'Playing');
});

test('moves and rotates pieces without allowing wall collisions', () => {
  const game = createGame(pieceAt(2)); // T
  const originalShape = game.piece.shape.map(row => [...row]);

  assert.equal(move(game, -1), true);
  assert.equal(game.piece.x, 2);
  assert.equal(turn(game), true);
  assert.notDeepEqual(game.piece.shape, originalShape);

  while (move(game, -1));
  const leftEdge = game.piece.x;
  assert.equal(move(game, -1), false);
  assert.equal(game.piece.x, leftEdge);
});

test('gravity locks a piece, clears full lines, and applies Tetris scoring', () => {
  const game = createGame(pieceAt(1)); // O
  game.board = Array.from({ length: BOARD_HEIGHT }, (_, y) =>
    y < BOARD_HEIGHT - 2 ? Array(BOARD_WIDTH).fill(null) : Array(BOARD_WIDTH).fill('red'));
  game.board[BOARD_HEIGHT - 1][4] = null;
  game.board[BOARD_HEIGHT - 1][5] = null;
  game.board[BOARD_HEIGHT - 2][4] = null;
  game.board[BOARD_HEIGHT - 2][5] = null;
  game.piece.x = 4;
  game.piece.y = BOARD_HEIGHT - 2;

  assert.equal(tick(game), true);
  assert.equal(game.lines, 2);
  assert.equal(game.score, 300);
  assert.equal(game.board.length, BOARD_HEIGHT);
  assert.ok(game.board.every(row => row.length === BOARD_WIDTH));
  assert.equal(game.piece.name, 'O');
});

test('hard drop locks immediately and spawning into occupied cells ends the game', () => {
  const game = createGame(pieceAt(1)); // O

  assert.equal(drop(game), true);
  assert.ok(game.board.slice(-2).every(row => row.slice(4, 6).every(cell => cell === 'yellow')));

  game.board[0][4] = 'red';
  game.piece.y = BOARD_HEIGHT - 2;
  tick(game);
  assert.equal(game.status, 'Game over');
  assert.equal(game.piece, null);
  assert.equal(move(game, 1), false);
});

test('clearing one through four lines uses the standard score table', () => {
  for (const [count, score] of [[1, 100], [2, 300], [3, 500], [4, 800]]) {
    const game = createGame(pieceAt(0));
    game.board = Array.from({ length: BOARD_HEIGHT }, (_, y) =>
      y >= BOARD_HEIGHT - count ? Array(BOARD_WIDTH).fill('cyan') : Array(BOARD_WIDTH).fill(null));

    assert.equal(clearLines(game), count);
    assert.equal(game.lines, count);
    assert.equal(game.score, score);
    assert.ok(game.board.every(row => row.every(cell => cell === null)));
  }
});
