import test from 'node:test';
import assert from 'node:assert/strict';
import { PIECE_TYPES, createInitialState, activeCells, canPlace, stepDown } from '../src/model.js';

for (const type of PIECE_TYPES) {
  for (const obstruction of ['floor', 'settled']) {
    test(`${type}: downward steps stop at ${obstruction} without locking`, () => {
      let calls = 0;
      const state = createInitialState(() => { calls++; return type; });
      if (obstruction === 'settled') state.board[10].fill('J');
      const board = state.board;
      const before = structuredClone(state);
      const cells = activeCells(state.active);
      assert.deepEqual(stepDown(state), { moved: true, blocked: false });
      assert.equal(state.active.y, before.active.y + 1);
      assert.equal(state.active.x, before.active.x);
      assert.deepEqual(activeCells(state.active), cells.map(([x, y]) => [x, y + 1]));
      assert.deepEqual(state.active.cells, before.active.cells);
      let steps = 1;
      while (stepDown(state).moved) {
        steps++;
        assert.ok(steps < 20, 'must stop before leaving the board');
        assert.equal(canPlace(board, state.active), true);
      }
      const bottom = Math.max(...activeCells(state.active).map(([, y]) => y));
      assert.equal(bottom, obstruction === 'floor' ? 19 : 9);
      const stopped = structuredClone(state);
      const piece = state.active;
      for (let i = 0; i < 3; i++) {
        assert.deepEqual(stepDown(state), { moved: false, blocked: true });
        assert.equal(state.active, piece);
        assert.deepEqual(state, stopped);
      }
      assert.equal(canPlace(board, state.active), true);
      assert.equal(state.board, board);
      assert.deepEqual(board, before.board);
      assert.equal(state.score, before.score);
      assert.equal(state.status, before.status);
      assert.equal(calls, 1);
    });
  }
}

test('one settled cell blocks a downward attempt atomically', () => {
  const state = createInitialState(() => 'T');
  state.board[2][state.active.x] = 'Z';
  assert.equal(canPlace(state.board, state.active), true);
  const before = structuredClone(state);
  const piece = state.active;
  assert.deepEqual(stepDown(state), { moved: false, blocked: true });
  assert.equal(state.active, piece);
  assert.deepEqual(state, before);
});

test('absent pieces and frozen statuses reject downward steps unchanged', () => {
  for (const status of ['running', 'paused', 'game-over']) {
    for (const absent of [false, true]) {
      if (status === 'running' && !absent) continue;
      const state = createInitialState(() => 'O');
      state.status = status;
      if (absent) state.active = null;
      const before = structuredClone(state);
      const piece = state.active;
      assert.deepEqual(stepDown(state), { moved: false, blocked: true });
      assert.equal(state.active, piece);
      assert.deepEqual(state, before);
    }
  }
});
