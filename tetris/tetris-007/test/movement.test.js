import test from 'node:test';
import assert from 'node:assert/strict';
import { PIECE_TYPES, createInitialState, activeCells, canPlace, moveLeft, moveRight } from '../src/model.js';

for (const type of PIECE_TYPES) {
  test(`${type}: horizontal steps, self overlap, and both walls`, () => {
    let calls = 0;
    const state = createInitialState(() => { calls++; return type; });
    const before = structuredClone(state);
    const board = state.board;
    assert.equal(canPlace(board, state.active), true);
    assert.deepEqual(moveLeft(state), { moved: true });
    assert.equal(state.active.x, before.active.x - 1);
    assert.deepEqual(moveRight(state), { moved: true });
    assert.deepEqual(state, before);
    for (const [action, edge] of [[moveLeft, 0], [moveRight, 9]]) {
      for (let i = 0; i < 20; i++) action(state);
      const xs = activeCells(state.active).map(([x]) => x);
      assert.equal(edge === 0 ? Math.min(...xs) : Math.max(...xs), edge);
      const snapshot = structuredClone(state);
      const piece = state.active;
      assert.deepEqual(action(state), { moved: false });
      assert.equal(state.active, piece);
      assert.deepEqual(state, snapshot);
      assert.equal(canPlace(board, state.active), true);
    }
    assert.equal(state.board, board);
    assert.deepEqual(board, before.board);
    assert.equal(calls, 1);
  });
}

for (const [name, action, dx] of [['left', moveLeft, -1], ['right', moveRight, 1]]) {
  test(`settled cell blocks ${name} atomically`, () => {
    const state = createInitialState(() => 'O');
    const cells = activeCells(state.active);
    const [x, y] = cells.find(([x, y]) => !cells.some(([cx, cy]) => cx === x + dx && cy === y));
    state.board[y][x + dx] = 'T';
    assert.equal(canPlace(state.board, state.active), true);
    const before = structuredClone(state);
    const piece = state.active;
    assert.deepEqual(action(state), { moved: false });
    assert.equal(state.active, piece);
    assert.deepEqual(state, before);
  });
}

test('placement rejects every boundary and settled overlap without mutation', () => {
  const state = createInitialState(() => 'O');
  const before = structuredClone(state);
  for (const [x, y] of [[-1, 0], [9, 0], [0, -1], [0, 19]]) {
    assert.equal(canPlace(state.board, { ...state.active, x, y }), false);
  }
  assert.equal(canPlace(state.board, null), false);
  assert.deepEqual(state, before);
  state.board[0][state.active.x] = 'J';
  assert.equal(canPlace(state.board, state.active), false);
});

test('absent pieces and non-running states reject movement unchanged', () => {
  for (const status of ['running', 'paused', 'game-over']) {
    const state = createInitialState(() => 'T');
    state.status = status;
    if (status === 'running') state.active = null;
    const before = structuredClone(state);
    assert.deepEqual(moveLeft(state), { moved: false });
    assert.deepEqual(moveRight(state), { moved: false });
    assert.deepEqual(state, before);
  }
});
