'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { BOARD_HEIGHT, BOARD_WIDTH, emptyBoard, renderFrame } = require('../src/render');
const {
  PIECE_TYPES,
  TETROMINOES,
  activeCells,
  canPlace,
  createGame,
  createPieceSource,
  moveLeft,
  moveRight,
  spawnPiece,
} = require('../src/game');

test('all seven tetrominoes contain four distinct cells', () => {
  assert.deepEqual(Object.keys(TETROMINOES), PIECE_TYPES);
  for (const [type, cells] of Object.entries(TETROMINOES)) {
    assert.equal(cells.length, 4, `${type} should contain four cells`);
    assert.equal(new Set(cells.map(({ x, y }) => `${x},${y}`)).size, 4);
  }
});

test('each piece spawns centered and fits an empty board', () => {
  for (const type of PIECE_TYPES) {
    const piece = spawnPiece(type);
    const cells = activeCells(piece);

    assert.equal(piece.y, 0);
    assert.ok(canPlace(emptyBoard(), piece));
    assert.ok(cells.every(({ x, y }) => x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT));
  }
});

test('piece sources are deterministic and can exercise every type', () => {
  const sequence = createPieceSource({ sequence: PIECE_TYPES });
  assert.deepEqual(PIECE_TYPES.map(() => sequence.nextType()), PIECE_TYPES);
  assert.equal(sequence.nextType(), 'I');

  const first = createPieceSource({ seed: 42 });
  const second = createPieceSource({ seed: 42 });
  assert.deepEqual(
    Array.from({ length: 20 }, () => first.nextType()),
    Array.from({ length: 20 }, () => second.nextType()),
  );
});

test('a new game uses the injected source for a valid initial piece', () => {
  const source = createPieceSource({ sequence: ['L'] });
  const game = createGame({ pieceSource: source });

  assert.equal(game.activePiece.type, 'L');
  assert.ok(canPlace(game.board, game.activePiece));
});

test('horizontal movement moves an unobstructed active piece by one column', () => {
  const game = createGame({ pieceSource: createPieceSource({ sequence: ['O'] }) });
  const startX = game.activePiece.x;

  assert.equal(moveLeft(game), true);
  assert.equal(game.activePiece.x, startX - 1);
  assert.equal(moveRight(game), true);
  assert.equal(game.activePiece.x, startX);
});

test('horizontal movement rejects walls and settled cells without changing the piece', () => {
  const wallGame = createGame({ pieceSource: createPieceSource({ sequence: ['O'] }) });
  while (moveLeft(wallGame)) {}
  const againstWall = wallGame.activePiece;
  assert.equal(moveLeft(wallGame), false);
  assert.strictEqual(wallGame.activePiece, againstWall);
  assert.equal(wallGame.activePiece.x, 0);

  const board = emptyBoard();
  const blockedGame = createGame({ board, pieceSource: createPieceSource({ sequence: ['O'] }) });
  const { x, y } = blockedGame.activePiece;
  board[y][x - 1] = true;
  const beforeBlock = blockedGame.activePiece;
  assert.equal(moveLeft(blockedGame), false);
  assert.strictEqual(blockedGame.activePiece, beforeBlock);
  assert.equal(blockedGame.activePiece.x, x);
});

test('repeated horizontal movement stays within both walls and ignores the active piece itself', () => {
  const game = createGame({ pieceSource: createPieceSource({ sequence: ['I'] }) });

  while (moveLeft(game)) {}
  assert.equal(game.activePiece.x, 0);
  assert.equal(moveLeft(game), false);

  while (moveRight(game)) {}
  assert.equal(game.activePiece.x, BOARD_WIDTH - 4);
  assert.equal(moveRight(game), false);
});

test('active pieces render distinctly from empty and settled cells within 24 rows', () => {
  const board = emptyBoard();
  board[19][0] = true;
  const game = createGame({ board, pieceSource: createPieceSource({ sequence: ['O'] }) });
  const frame = renderFrame(game);
  const rows = frame.split('\n');

  assert.equal(rows.length, 24);
  assert.match(frame, /░░/);
  assert.match(frame, /██/);
});
