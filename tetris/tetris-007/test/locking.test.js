import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PIECE_TYPES, activeCells, canPlace, createInitialState, createSpawnPiece,
  descend, lockPiece, stepDown,
} from '../src/model.js';

function grounded(type = 'O') {
  const state = createInitialState(() => type);
  while (stepDown(state).moved) {}
  return state;
}

for (const type of PIECE_TYPES) {
  test(`${type}: lock copies exactly four cells and spawns without advancing`, () => {
    const state = grounded(type);
    state.board[10][0] = 'J';
    const expected = structuredClone(state.board);
    for (const [x, y] of activeCells(state.active)) expected[y][x] = type;
    let calls = 0;
    const result = descend(state, () => { calls++; return 'T'; });
    assert.deepEqual(result, { moved: false, locked: true, clearedRows: 0, spawned: true, spawnBlocked: false });
    assert.equal(calls, 1);
    assert.deepEqual(state.board, expected);
    assert.deepEqual(state.active, createSpawnPiece('T'));
    assert.equal(canPlace(state.board, state.active), true);
    assert.equal(state.score, 0);
    assert.equal(state.status, 'running');
    assert.equal(lockPiece(state, () => { throw Error('unexpected source'); }).locked, false);
    assert.deepEqual(state.board, expected);
  });
}

test('successful downward action moves once without locking or consuming a type', () => {
  const state = createInitialState(() => 'T');
  const board = structuredClone(state.board);
  const y = state.active.y;
  assert.deepEqual(descend(state, () => { throw Error('unexpected source'); }),
    { moved: true, locked: false, clearedRows: 0, spawned: false, spawnBlocked: false });
  assert.equal(state.active.y, y + 1);
  assert.deepEqual(state.board, board);
});

test('a settled obstruction grounds a piece above the floor', () => {
  const state = createInitialState(() => 'O');
  state.board[2][4] = 'J';
  const cells = activeCells(state.active);
  assert.equal(lockPiece(state, () => 'I').locked, true);
  for (const [x, y] of cells) assert.equal(state.board[y][x], 'O');
  assert.equal(state.board[2][4], 'J');
  assert.equal(state.active, null); // The newly settled O obstructs the next spawn.
});

test('blocked spawn consumes once, preserves board and score, and never retries', () => {
  const state = grounded();
  state.board[0][4] = 'J';
  state.score = 123;
  let calls = 0;
  const source = () => { calls++; return 'O'; };
  assert.deepEqual(descend(state, source),
    { moved: false, locked: true, clearedRows: 0, spawned: false, spawnBlocked: true });
  assert.equal(state.active, null);
  assert.equal(state.board[0][4], 'J');
  assert.equal(state.score, 123);
  assert.equal(state.status, 'running');
  const snapshot = structuredClone(state);
  assert.equal(descend(state, source).locked, false);
  assert.deepEqual(state, snapshot);
  assert.equal(calls, 1);
});

for (const scenario of ['absent', 'ungrounded', 'paused', 'game-over', 'overlap', 'out-of-bounds']) {
  test(`${scenario}: invalid lock is an atomic no-op`, () => {
    const state = scenario === 'ungrounded' ? createInitialState(() => 'O') : grounded();
    if (scenario === 'absent') state.active = null;
    if (scenario === 'paused' || scenario === 'game-over') state.status = scenario;
    if (scenario === 'overlap') {
      const [x, y] = activeCells(state.active)[0];
      state.board[y][x] = 'J';
    }
    if (scenario === 'out-of-bounds') state.active.x = -10;
    const snapshot = structuredClone(state);
    const active = state.active;
    assert.equal(lockPiece(state, () => { throw Error('unexpected source'); }).locked, false);
    assert.deepEqual(state, snapshot);
    assert.equal(state.active, active);
    if (scenario !== 'ungrounded') {
      assert.equal(descend(state, () => { throw Error('unexpected source'); }).locked, false);
      assert.deepEqual(state, snapshot);
    }
  });
}

test('invalid next type fails before changing the grounded state', () => {
  const state = grounded();
  const snapshot = structuredClone(state);
  assert.throws(() => lockPiece(state, () => 'unknown'), RangeError);
  assert.deepEqual(state, snapshot);
});
