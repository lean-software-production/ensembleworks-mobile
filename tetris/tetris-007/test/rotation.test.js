import test from 'node:test';
import assert from 'node:assert/strict';
import { PIECE_TYPES, TETROMINOES, createInitialState, activeCells, canPlace, rotateClockwise } from '../src/model.js';

// Exact canonical geometry and clockwise spawn outcome (local frame coordinates).
const geometry = {
  I: [4, [[0,1],[1,1],[2,1],[3,1]], null],
  O: [2, [[0,0],[1,0],[0,1],[1,1]], null],
  T: [3, [[1,0],[0,1],[1,1],[2,1]], [[2,1],[1,0],[1,1],[1,2]]],
  S: [3, [[1,0],[2,0],[0,1],[1,1]], [[2,1],[2,2],[1,0],[1,1]]],
  Z: [3, [[0,0],[1,0],[1,1],[2,1]], [[2,0],[2,1],[1,1],[1,2]]],
  J: [3, [[0,0],[0,1],[1,1],[2,1]], [[2,0],[1,0],[1,1],[1,2]]],
  L: [3, [[2,0],[0,1],[1,1],[2,1]], [[2,2],[1,0],[1,1],[1,2]]],
};

function rejectsUnchanged(state) {
  const before = structuredClone(state);
  const piece = state.active;
  assert.deepEqual(rotateClockwise(state), { rotated: false });
  assert.deepEqual(state, before);
  assert.equal(state.active, piece);
}

for (const type of PIECE_TYPES) {
  test(`${type}: canonical geometry and spawn rotation`, () => {
    const [size, cells, rotated] = geometry[type];
    assert.deepEqual(TETROMINOES[type], { size, cells });
    const state = createInitialState(() => type);
    if (!rotated) {
      if (type === 'I') assert.equal(state.active.y, -1);
      rejectsUnchanged(state);
    } else {
      const { x, y } = state.active;
      assert.deepEqual(rotateClockwise(state), { rotated: true });
      assert.deepEqual(state.active.cells, rotated);
      assert.equal(state.active.x, x);
      assert.equal(state.active.y, y);
      assert.equal(canPlace(state.board, state.active), true);
    }
  });

  test(`${type}: four legal turns restore exact geometry/location without side effects`, () => {
    let calls = 0;
    const state = createInitialState(() => { calls++; return type; });
    state.active.y = 5;
    const before = structuredClone(state);
    const board = state.board;
    for (let turn = 0; turn < 4; turn++) {
      assert.deepEqual(rotateClockwise(state), { rotated: type !== 'O' });
      assert.equal(new Set(activeCells(state.active).map(cell => cell.join(','))).size, 4);
      assert.equal(canPlace(state.board, state.active), true);
      assert.equal(state.board, board);
      assert.deepEqual(state.board, before.board);
      assert.equal(state.score, before.score);
    }
    assert.deepEqual(state, before);
    assert.equal(calls, 1);
  });
}

test('no kicks at either wall or floor; above-board spawn rejection is atomic', () => {
  for (const x of [-1, 7]) {
    const state = createInitialState(() => 'I');
    state.active.y = 5;
    rotateClockwise(state); // Vertical I occupies local column 2.
    state.active.x = x;
    assert.equal(canPlace(state.board, state.active), true);
    rejectsUnchanged(state);
  }
  const state = createInitialState(() => 'I');
  state.active.y = 18; // Horizontal occupied row 19; vertical would exceed floor.
  assert.equal(canPlace(state.board, state.active), true);
  rejectsUnchanged(state);
  rejectsUnchanged(createInitialState(() => 'I'));
});

test('settled cells reject rotation without affecting board or active identity', () => {
  for (const type of PIECE_TYPES.filter(type => type !== 'O')) {
    const state = createInitialState(() => type);
    state.active.y = 5;
    const original = state.active;
    const occupied = activeCells(original).map(cell => cell.join(','));
    rotateClockwise(state);
    const [x, y] = activeCells(state.active).find(cell => !occupied.includes(cell.join(',')));
    state.active = original;
    state.board[y][x] = 'O';
    assert.equal(canPlace(state.board, state.active), true);
    rejectsUnchanged(state);
  }
});

test('absent pieces and frozen statuses reject rotation', () => {
  for (const status of ['running', 'paused', 'game-over']) {
    const state = createInitialState(() => 'T');
    state.status = status;
    if (status === 'running') state.active = null;
    rejectsUnchanged(state);
  }
});
