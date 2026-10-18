import test from 'node:test';
import assert from 'node:assert/strict';
import { SHAPES, TYPES, createPieceSource, spawnPiece, createInitialGame } from '../src/model.js';
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

test('launch seam accepts injected piece source without changing board', () => {
  let frame = '';
  const game = start({ source: { next: () => 'I' }, output: { write: text => { frame += text; } } });
  assert.equal(game.active.type, 'I');
  assert.equal((frame.match(/<>/g) ?? []).length, 4);
  assert.equal(frame.split('\n').length, 24);
});
