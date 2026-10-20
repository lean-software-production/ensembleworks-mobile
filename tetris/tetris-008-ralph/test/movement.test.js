import test from 'node:test';
import assert from 'node:assert/strict';
import { PIECE_TYPES, createGame, activeCells, canPlace, moveHorizontal, moveLeft, moveRight } from '../src/model.js';

test('all pieces move one column without self-collision or changing settled cells', () => {
  for (const type of PIECE_TYPES) {
    const game = createGame(() => type);
    const before = structuredClone(game);
    const board = game.board;
    assert.equal(canPlace(board, game.active), true);
    assert.equal(moveLeft(game), true);
    assert.deepEqual(activeCells(game.active), activeCells(before.active).map(([x, y]) => [x - 1, y]));
    assert.equal(moveRight(game), true);
    assert.deepEqual(game, before);
    assert.equal(game.board, board);
  }
});

test('repeated horizontal movement reaches but never crosses either wall', () => {
  for (const type of PIECE_TYPES) {
    const game = createGame(() => type);
    for (const [action, boundary] of [[moveLeft, 0], [moveRight, 9]]) {
      for (let i = 0; i < 30; i++) {
        const before = structuredClone(game);
        const active = game.active;
        if (!action(game)) {
          assert.deepEqual(game, before);
          assert.equal(game.active, active);
        }
        assert.equal(canPlace(game.board, game.active), true);
      }
      const xs = activeCells(game.active).map(([x]) => x);
      assert.equal(boundary === 0 ? Math.min(...xs) : Math.max(...xs), boundary);
    }
  }
});

test('settled cells reject either direction without any state changes', () => {
  for (const type of PIECE_TYPES) {
    for (const direction of [-1, 1]) {
      const game = createGame(() => type);
      const occupied = new Set(activeCells(game.active).map(String));
      const candidate = { ...game.active, x: game.active.x + direction };
      const [x, y] = activeCells(candidate).find(cell => !occupied.has(String(cell)));
      game.board[y][x] = 'Z';
      assert.equal(canPlace(game.board, game.active), true);
      assert.equal(canPlace(game.board, candidate), false);
      const before = structuredClone(game);
      const active = game.active;
      assert.equal(moveHorizontal(game, direction), false);
      assert.deepEqual(game, before);
      assert.equal(game.active, active);
    }
  }
});

test('placement rejects floor/top bounds and actions ignore unavailable play states', () => {
  const game = createGame(() => 'O');
  for (const y of [-1, 19, 20]) {
    assert.equal(canPlace(game.board, { ...game.active, y }), false);
  }
  for (const direction of [0, 2, NaN]) {
    const before = structuredClone(game);
    assert.equal(moveHorizontal(game, direction), false);
    assert.deepEqual(game, before);
  }
  for (const status of ['paused', 'game-over']) {
    game.status = status;
    const before = structuredClone(game);
    assert.equal(moveLeft(game), false);
    assert.equal(moveRight(game), false);
    assert.deepEqual(game, before);
  }
  game.status = 'running';
  game.active = null;
  assert.equal(moveLeft(game), false);
});
