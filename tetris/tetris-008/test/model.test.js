import test from 'node:test';
import assert from 'node:assert/strict';
import { SHAPES, TYPES, createPieceSource, spawnPiece, createInitialGame, canPlace, moveHorizontal } from '../src/model.js';
import { renderFrame, WIDTH, HEIGHT } from '../src/render.js';
import { start } from '../src/index.js';

test('all seven distinct tetrominoes spawn centered, in bounds on an empty board', () => {
  assert.equal(TYPES.length, 7);
  for (const type of TYPES) {
    const cells = SHAPES[type];
    assert.equal(cells.length, 4, type);
    assert.equal(new Set(cells.map(cell => cell.join(','))).size, 4, type);
    const piece = spawnPiece(type);
    const xs = piece.cells.map(([x]) => x + piece.x);
    assert.ok(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - (WIDTH - 1) / 2) <= 0.5, type);
    assert.ok(piece.cells.every(([x, y]) => x + piece.x >= 0 && x + piece.x < WIDTH && y + piece.y >= 0 && y + piece.y < HEIGHT), type);
  }
});

test('seeded source replays and exercises every piece; injected source selects spawn', () => {
  const source = createPieceSource(42);
  const sequence = Array.from({ length: 200 }, () => source.next());
  assert.deepEqual(new Set(sequence), new Set(TYPES));
  source.reset();
  assert.deepEqual(Array.from({ length: 200 }, () => source.next()), sequence);
  assert.equal(createPieceSource(42).next(), sequence[0]);
  for (const type of TYPES) {
    const game = createInitialGame({ source: { next: () => type } });
    assert.equal(game.active.type, type);
    assert.equal(game.score, 0);
    assert.equal(game.status, 'running');
    assert.equal(game.board.length, HEIGHT);
    assert.ok(game.board.every(row => row.length === WIDTH && row.every(cell => cell === null)));
    const frame = renderFrame(game);
    assert.equal(frame.split('\n').length, 24);
    assert.equal((frame.match(/<>/g) ?? []).length, 4);
    assert.ok(frame.split('\n').every(line => line.length <= 50));
  }
});

test('horizontal moves use one-cell steps and do not collide with the active piece', () => {
  const game = createInitialGame({ source: { next: () => 'O' } });
  const left = moveHorizontal(game, -1);
  assert.equal(left.active.x, game.active.x - 1);
  assert.equal(moveHorizontal(left, 1).active.x, game.active.x);
  assert.equal(canPlace(game.board, game.active), true);
  assert.equal(game.active.x, 4);
  assert.strictEqual(left.board, game.board);
});

test('walls reject repeated movement without changing state', () => {
  for (const type of TYPES) {
    for (const direction of [-1, 1]) {
      let game = createInitialGame({ source: { next: () => type } });
      for (let i = 0; i < WIDTH * 2; i++) game = moveHorizontal(game, direction);
      const edge = game;
      for (let i = 0; i < WIDTH * 2; i++) assert.strictEqual(moveHorizontal(game, direction), edge);
      assert.ok(edge.active.cells.every(([dx]) => edge.active.x + dx >= 0 && edge.active.x + dx < WIDTH));
    }
  }
});

test('settled cells block movement while preserving board and active state', () => {
  const game = createInitialGame({ source: { next: () => 'O' } });
  game.board[0][6] = 'T';
  const snapshot = structuredClone(game);
  assert.equal(canPlace(game.board, { ...game.active, x: 5 }), false);
  assert.strictEqual(moveHorizontal(game, 1), game);
  assert.deepEqual(game, snapshot);
  assert.equal(moveHorizontal(game, -1).active.x, 3);
  assert.equal(game.board[0][6], 'T');
});

test('launch seam accepts injected piece source without changing board', () => {
  let frame = '';
  const game = start({ source: { next: () => 'I' }, output: { write: text => { frame += text; } } });
  assert.equal(game.active.type, 'I');
  assert.equal((frame.match(/<>/g) ?? []).length, 4);
  assert.equal(frame.split('\n').length, 24);
});
