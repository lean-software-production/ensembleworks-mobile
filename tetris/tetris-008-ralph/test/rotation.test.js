import test from 'node:test';
import assert from 'node:assert/strict';
import { PIECE_TYPES, SHAPES, createGame, activeCells, canPlace, rotateClockwise } from '../src/model.js';

test('clockwise fixed-square rule preserves four cells and restores every type in four turns', () => {
  const definitions = structuredClone(SHAPES);
  for (const type of PIECE_TYPES) {
    const game = createGame(() => type);
    const before = structuredClone(game);
    const board = game.board;
    for (let turn = 0; turn < 4; turn++) {
      const previous = structuredClone(game.active);
      assert.equal(rotateClockwise(game), true);
      const size = type === 'I' ? 4 : 3;
      assert.deepEqual(game.active.cells, type === 'O' ? previous.cells :
        previous.cells.map(([x, y]) => [size - 1 - y, x]));
      assert.equal(new Set(activeCells(game.active).map(String)).size, 4);
      assert.equal(canPlace(board, game.active), true);
      assert.equal(game.board, board);
      assert.equal(game.active.x, before.active.x);
      assert.equal(game.active.y, before.active.y);
    }
    assert.deepEqual(game, before);
  }
  assert.deepEqual(SHAPES, definitions);
});

function rejectedUnchanged(game) {
  const before = structuredClone(game);
  const active = game.active;
  assert.equal(rotateClockwise(game), false);
  assert.deepEqual(game, before);
  assert.equal(game.active, active);
}

test('all orientations reject out-of-bounds rotation without kicks or state changes', () => {
  const rejected = new Set();
  for (const type of PIECE_TYPES.filter(type => type !== 'O')) {
    const source = createGame(() => type);
    for (let turn = 0; turn < 4; turn++) {
      for (let y = -3; y < 20; y++) {
        for (let x = -3; x < 10; x++) {
          const game = structuredClone(source);
          Object.assign(game.active, { x, y });
          if (!canPlace(game.board, game.active)) continue;
          const size = type === 'I' ? 4 : 3;
          const candidate = { ...game.active, cells: game.active.cells.map(([cx, cy]) => [size - 1 - cy, cx]) };
          if (canPlace(game.board, candidate)) continue;
          for (const [cx, cy] of activeCells(candidate)) {
            if (cx < 0) rejected.add('left');
            if (cx >= 10) rejected.add('right');
            if (cy >= 20) rejected.add('floor');
          }
          rejectedUnchanged(game);
        }
      }
      assert.equal(rotateClockwise(source), true);
    }
  }
  assert.deepEqual([...rejected].sort(), ['floor', 'left', 'right']);
});

test('settled obstacles reject rotation for every non-square type and orientation', () => {
  for (const type of PIECE_TYPES.filter(type => type !== 'O')) {
    const source = createGame(() => type);
    for (let turn = 0; turn < 4; turn++) {
      const game = structuredClone(source);
      const occupied = new Set(activeCells(game.active).map(String));
      const rotated = structuredClone(source);
      assert.equal(rotateClockwise(rotated), true);
      const [x, y] = activeCells(rotated.active).find(cell => !occupied.has(String(cell)));
      game.board[y][x] = 'Z';
      assert.equal(canPlace(game.board, game.active), true);
      rejectedUnchanged(game);
      assert.equal(rotateClockwise(source), true);
    }
  }
});

test('square is a reference-preserving no-op; unavailable play states reject rotation', () => {
  const game = createGame(() => 'O');
  const active = game.active;
  const before = structuredClone(game);
  assert.equal(rotateClockwise(game), true);
  assert.equal(game.active, active);
  assert.deepEqual(game, before);
  for (const status of ['paused', 'game-over']) {
    game.status = status;
    rejectedUnchanged(game);
  }
  game.status = 'running';
  game.active = null;
  rejectedUnchanged(game);
});
