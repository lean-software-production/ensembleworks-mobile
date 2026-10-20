import test from 'node:test';
import assert from 'node:assert/strict';
import { PIECE_TYPES, createGame, activeCells, canPlace, moveDown, rotateClockwise } from '../src/model.js';

test('descent moves exactly one row without settling, scoring, or consuming pieces', () => {
  for (const type of PIECE_TYPES) {
    let calls = 0;
    const game = createGame(() => { calls++; return type; });
    const before = structuredClone(game);
    const board = game.board;
    assert.equal(moveDown(game), true);
    assert.deepEqual(activeCells(game.active), activeCells(before.active).map(([x, y]) => [x, y + 1]));
    assert.deepEqual(game, { ...before, active: { ...before.active, y: 1 } });
    assert.equal(game.board, board);
    assert.equal(calls, 1);
  }
});

test('repeated descent stops at the floor for every type and orientation', () => {
  for (const type of PIECE_TYPES) {
    for (let turns = 0; turns < 4; turns++) {
      let calls = 0;
      const game = createGame(() => { calls++; return type; });
      for (let i = 0; i < turns; i++) assert.equal(rotateClockwise(game), true);
      const before = structuredClone(game);
      const board = game.board;
      const distance = 19 - Math.max(...activeCells(game.active).map(([, y]) => y));
      for (let i = 0; i < distance; i++) {
        assert.equal(moveDown(game), true);
        assert.equal(game.active.y, before.active.y + i + 1);
        assert.equal(canPlace(game.board, game.active), true);
      }
      const grounded = structuredClone(game);
      const active = game.active;
      for (let i = 0; i < 3; i++) {
        assert.equal(moveDown(game), false);
        assert.deepEqual(game, grounded);
        assert.equal(game.active, active);
      }
      assert.deepEqual(game.board, before.board);
      assert.equal(game.board, board);
      assert.equal(game.score, before.score);
      assert.equal(calls, 1);
    }
  }
});

test('settled cells stop descent at the first obstruction without mutation', () => {
  for (const type of PIECE_TYPES) {
    for (let turns = 0; turns < 4; turns++) {
      const game = createGame(() => type);
      for (let i = 0; i < turns; i++) rotateClockwise(game);
      const [x, bottom] = activeCells(game.active).reduce((a, b) => b[1] > a[1] ? b : a);
      game.board[bottom + 4][x] = 'Z';
      const boardBefore = structuredClone(game.board);
      const board = game.board;
      for (let i = 0; i < 3; i++) assert.equal(moveDown(game), true);
      assert.equal(canPlace(game.board, game.active), true);
      const before = structuredClone(game);
      const active = game.active;
      for (let i = 0; i < 3; i++) {
        assert.equal(moveDown(game), false);
        assert.deepEqual(game, before);
        assert.equal(game.active, active);
      }
      assert.equal(game.board, board);
      assert.deepEqual(game.board, boardBefore);
    }
  }
});

test('descent ignores paused, game-over, and missing-active states', () => {
  const game = createGame(() => 'O');
  for (const status of ['paused', 'game-over']) {
    game.status = status;
    const before = structuredClone(game);
    const active = game.active;
    assert.equal(moveDown(game), false);
    assert.deepEqual(game, before);
    assert.equal(game.active, active);
  }
  game.status = 'running';
  game.active = null;
  const before = structuredClone(game);
  assert.equal(moveDown(game), false);
  assert.deepEqual(game, before);
});
