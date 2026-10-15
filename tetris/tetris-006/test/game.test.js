'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { BOARD_HEIGHT, BOARD_WIDTH, emptyBoard, renderFrame } = require('../src/render');
const {
  PIECE_TYPES,
  SCORE_BY_LINES,
  TETROMINOES,
  activeCells,
  canPlace,
  clearCompletedLines,
  createGame,
  createPieceSource,
  moveLeft,
  moveRight,
  moveDown,
  lockPiece,
  pointsForLines,
  advanceGame,
  rotateClockwise,
  restartGame,
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

test('downward movement moves exactly one row without locking', () => {
  const game = createGame({ pieceSource: createPieceSource({ sequence: ['O'] }) });
  const startY = game.activePiece.y;
  const boardBefore = game.board.map((row) => [...row]);

  assert.equal(moveDown(game), true);
  assert.equal(game.activePiece.y, startY + 1);
  assert.deepEqual(game.board, boardBefore);
  assert.equal(game.board.flat().filter(Boolean).length, 0);
});

test('downward movement rejects floor and settled cells without changing state', () => {
  const floorGame = createGame({ pieceSource: createPieceSource({ sequence: ['O'] }) });
  floorGame.activePiece.y = BOARD_HEIGHT - 2;
  const onFloor = floorGame.activePiece;
  const floorBoard = floorGame.board.map((row) => [...row]);
  assert.equal(moveDown(floorGame), false);
  assert.strictEqual(floorGame.activePiece, onFloor);
  assert.deepEqual(floorGame.board, floorBoard);

  const board = emptyBoard();
  const blockedGame = createGame({ board, pieceSource: createPieceSource({ sequence: ['O'] }) });
  const { x, y } = blockedGame.activePiece;
  board[y + 2][x] = true;
  const aboveBlock = blockedGame.activePiece;
  assert.equal(moveDown(blockedGame), false);
  assert.strictEqual(blockedGame.activePiece, aboveBlock);
  assert.equal(board[y + 2][x], true);
});

test('repeated downward movement stops at the first obstruction without locking', () => {
  const game = createGame({ pieceSource: createPieceSource({ sequence: ['I'] }) });
  const boardBefore = game.board.map((row) => [...row]);

  let steps = 0;
  while (moveDown(game)) steps += 1;

  assert.equal(steps, BOARD_HEIGHT - 1);
  assert.equal(game.activePiece.y, BOARD_HEIGHT - 1);
  assert.equal(moveDown(game), false);
  assert.deepEqual(game.board, boardBefore);
  assert.equal(game.board.flat().filter(Boolean).length, 0);
});

test('locking copies exactly the active piece into the settled board', () => {
  const board = emptyBoard();
  board[0][0] = true;
  const game = createGame({ board, pieceSource: createPieceSource({ sequence: ['O'] }) });
  game.activePiece.y = BOARD_HEIGHT - 2;
  const cells = activeCells(game.activePiece);

  lockPiece(game);

  assert.equal(board.flat().filter(Boolean).length, 5);
  assert.equal(board[0][0], true);
  for (const { x, y } of cells) assert.equal(board[y][x], true);
});

test('advanceGame moves without locking and does not consume a next piece', () => {
  let calls = 0;
  const source = { nextType: () => ['O', 'T', 'L'][calls++] };
  const game = createGame({ pieceSource: source });
  const boardBefore = game.board.map((row) => [...row]);

  assert.deepEqual(advanceGame(game), {
    moved: true, locked: false, spawned: false, spawnBlocked: false, linesCleared: 0,
  });
  assert.equal(calls, 1);
  assert.equal(game.activePiece.type, 'O');
  assert.deepEqual(game.board, boardBefore);
});

test('a blocked advance locks once and consumes exactly one next piece', () => {
  let calls = 0;
  const source = { nextType: () => ['O', 'T', 'L'][calls++] };
  const game = createGame({ pieceSource: source });
  game.activePiece.y = BOARD_HEIGHT - 2;

  assert.deepEqual(advanceGame(game), {
    moved: false, locked: true, spawned: true, spawnBlocked: false, linesCleared: 0,
  });
  assert.equal(calls, 2);
  assert.equal(game.board.flat().filter(Boolean).length, 4);
  assert.equal(game.activePiece.type, 'T');

  assert.equal(moveDown(game), true);
  assert.equal(calls, 2, 'the action that spawned T must not advance to L');
  assert.equal(game.board.flat().filter(Boolean).length, 4);
});

test('a blocked next spawn leaves no overlapping active piece', () => {
  const game = createGame({ pieceSource: createPieceSource({ sequence: ['O'] }) });
  game.activePiece.y = BOARD_HEIGHT - 2;
  game.board[0][game.activePiece.x] = true;

  assert.deepEqual(advanceGame(game), {
    moved: false, locked: true, spawned: false, spawnBlocked: true, linesCleared: 0,
  });
  assert.equal(game.activePiece, null);
  assert.equal(game.gameOver, true);
  assert.equal(game.board.flat().filter(Boolean).length, 5);
});

test('completed-line clearing handles zero through four simultaneous rows', () => {
  for (let count = 0; count <= 4; count += 1) {
    const board = emptyBoard();
    for (let y = BOARD_HEIGHT - count; y < BOARD_HEIGHT; y += 1) board[y].fill(true);

    assert.equal(clearCompletedLines(board), count);
    assert.equal(board.length, BOARD_HEIGHT);
    assert.ok(board.every((row) => row.length === BOARD_WIDTH));
    assert.ok(board.slice(0, count).every((row) => row.every((cell) => !cell)));
    assert.ok(board.slice(count).every((row) => row.every((cell) => !cell)));
  }
});

test('line clearing compacts nonadjacent rows while retaining remaining row order', () => {
  const board = emptyBoard();
  board[2][0] = true;
  board[4].fill(true);
  board[7][1] = true;
  board[12].fill(true);
  board[18][2] = true;

  assert.equal(clearCompletedLines(board), 2);
  assert.ok(board[0].every((cell) => !cell));
  assert.ok(board[1].every((cell) => !cell));
  assert.equal(board[4][0], true, 'old row 2 follows the inserted empty rows');
  assert.equal(board[8][1], true, 'old row 7 retains its order after compaction');
  assert.equal(board[18][2], true, 'old row 18 retains its order after compaction');
});

test('a blocked advance locks, clears a completed row, and then spawns the next piece', () => {
  const board = emptyBoard();
  // A horizontal I at its centered x=3 completes this otherwise filled row.
  for (let x = 0; x < BOARD_WIDTH; x += 1) {
    if (x < 3 || x > 6) board[BOARD_HEIGHT - 1][x] = true;
  }
  const game = createGame({ board, pieceSource: createPieceSource({ sequence: ['I', 'O'] }) });
  game.activePiece.y = BOARD_HEIGHT - 1;

  assert.deepEqual(advanceGame(game), {
    moved: false, locked: true, spawned: true, spawnBlocked: false, linesCleared: 1,
  });
  assert.equal(game.activePiece.type, 'O');
  assert.ok(game.board[BOARD_HEIGHT - 1].every((cell) => !cell));
  assert.equal(game.board.flat().filter(Boolean).length, 0);
});

test('scoring uses the documented table for each supported lock clear count', () => {
  assert.deepEqual(SCORE_BY_LINES, [0, 100, 300, 500, 800]);
  for (const [lines, points] of SCORE_BY_LINES.entries()) {
    assert.equal(pointsForLines(lines), points);

    const board = emptyBoard();
    for (let y = BOARD_HEIGHT - lines; y < BOARD_HEIGHT; y += 1) {
      board[y].fill(true);
      board[y][3] = false;
    }
    const game = createGame({ board, pieceSource: createPieceSource({ sequence: ['I', 'O'] }) });
    game.activePiece = {
      ...game.activePiece,
      x: 3,
      y: BOARD_HEIGHT - 4,
      cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }],
    };

    assert.equal(advanceGame(game).linesCleared, lines);
    assert.equal(game.score, points);
  }
});

test('score updates once for each locking clear and accumulates across locks', () => {
  const board = emptyBoard();
  const game = createGame({ board, pieceSource: createPieceSource({ sequence: ['I', 'I', 'O'] }) });

  // First I completes one row, then the second completes another one.
  for (const y of [BOARD_HEIGHT - 1, BOARD_HEIGHT - 2]) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      if (x < 3 || x > 6) board[y][x] = true;
    }
  }
  game.activePiece.y = BOARD_HEIGHT - 1;
  assert.equal(advanceGame(game).linesCleared, 1);
  assert.equal(game.score, 100);

  game.activePiece.y = BOARD_HEIGHT - 1;
  assert.equal(advanceGame(game).linesCleared, 1);
  assert.equal(game.score, 200);
});

test('movement, failed movement, rotation, and zero-line locks do not score points', () => {
  const game = createGame({ pieceSource: createPieceSource({ sequence: ['O', 'T'] }) });
  assert.equal(moveDown(game), true);
  assert.equal(moveLeft(game), true);
  assert.equal(rotateClockwise(game), true);
  while (moveLeft(game)) {}
  assert.equal(moveLeft(game), false);
  assert.equal(game.score, 0);

  game.activePiece.y = BOARD_HEIGHT - 2;
  assert.equal(advanceGame(game).linesCleared, 0);
  assert.equal(game.score, 0);
});

test('clockwise rotation preserves four cells and four rotations restore every shape', () => {
  for (const type of PIECE_TYPES) {
    const game = createGame({ pieceSource: createPieceSource({ sequence: [type] }) });
    game.activePiece.y = 3;
    const originalCells = game.activePiece.cells.map(({ x, y }) => ({ x, y }));

    for (let turn = 0; turn < 4; turn += 1) {
      assert.equal(rotateClockwise(game), true, `${type} rotation ${turn + 1} should fit`);
      assert.equal(game.activePiece.cells.length, 4);
      assert.equal(new Set(game.activePiece.cells.map(({ x, y }) => `${x},${y}`)).size, 4);
    }
    assert.deepEqual(game.activePiece.cells, originalCells, `${type} should complete a rotation cycle`);
  }
});

test('rotation rejects wall, floor, and settled-cell collisions without changing state', () => {
  const wallGame = createGame({ pieceSource: createPieceSource({ sequence: ['I'] }) });
  assert.equal(rotateClockwise(wallGame), true);
  while (moveRight(wallGame)) {}
  const againstWall = wallGame.activePiece;
  assert.equal(rotateClockwise(wallGame), false);
  assert.strictEqual(wallGame.activePiece, againstWall);

  const floorGame = createGame({ pieceSource: createPieceSource({ sequence: ['I'] }) });
  floorGame.activePiece.y = BOARD_HEIGHT - 1;
  const onFloor = floorGame.activePiece;
  assert.equal(rotateClockwise(floorGame), false);
  assert.strictEqual(floorGame.activePiece, onFloor);

  const board = emptyBoard();
  const blockedGame = createGame({ board, pieceSource: createPieceSource({ sequence: ['T'] }) });
  const { x, y } = blockedGame.activePiece;
  board[y + 2][x + 1] = true;
  const againstBlock = blockedGame.activePiece;
  assert.equal(rotateClockwise(blockedGame), false);
  assert.strictEqual(blockedGame.activePiece, againstBlock);
});

test('line clearing occurs before deciding whether the next piece can spawn', () => {
  const board = emptyBoard();
  // An O at x=4 completes both top rows. The block beneath it makes that O
  // grounded, but compaction moves the blocker away before the next O spawns.
  for (const y of [0, 1]) {
    board[y].fill(true);
    board[y][4] = false;
    board[y][5] = false;
  }
  board[2][4] = true;
  const game = createGame({ board, pieceSource: createPieceSource({ sequence: ['O'] }) });

  assert.deepEqual(advanceGame(game), {
    moved: false, locked: true, spawned: true, spawnBlocked: false, linesCleared: 2,
  });
  assert.equal(game.gameOver, false);
  assert.equal(game.activePiece.type, 'O');
  assert.ok(canPlace(game.board, game.activePiece));
});

test('game-over actions preserve settled cells and score, and restart makes a fresh game', () => {
  const game = createGame({ pieceSource: createPieceSource({ sequence: ['O', 'T', 'L'] }) });
  game.activePiece.y = BOARD_HEIGHT - 2;
  game.board[0][game.activePiece.x] = true;
  advanceGame(game);

  const boardBefore = game.board.map((row) => [...row]);
  const scoreBefore = game.score;
  assert.equal(moveLeft(game), false);
  assert.equal(moveRight(game), false);
  assert.equal(moveDown(game), false);
  assert.equal(rotateClockwise(game), false);
  assert.deepEqual(advanceGame(game), {
    moved: false, locked: false, spawned: false, spawnBlocked: false, linesCleared: 0, gameOver: true,
  });
  assert.deepEqual(game.board, boardBefore);
  assert.equal(game.score, scoreBefore);

  assert.strictEqual(restartGame(game), game);
  assert.equal(game.gameOver, false);
  assert.equal(game.score, 0);
  assert.equal(game.activePiece.type, 'L');
  assert.ok(game.board.every((row) => row.every((cell) => !cell)));
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
