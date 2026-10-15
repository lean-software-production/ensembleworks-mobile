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
