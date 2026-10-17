import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_WIDTH, BOARD_HEIGHT, clearFullRows, createEmptyState,
  createInitialState, createSpawnPiece, descend, lockPiece, stepDown,
} from '../src/model.js';

for (const rows of [[], [19], [18, 19], [17, 18, 19], [16, 17, 18, 19], [2, 8, 15]]) {
  test(`simultaneous clear of rows ${JSON.stringify(rows)} preserves survivor order`, () => {
    const { board } = createEmptyState();
    // Distinct partial rows make any reordering or misplaced padding observable.
    for (let y = 0; y < BOARD_HEIGHT; y++) board[y][0] = `marker-${y}`;
    for (const y of rows) board[y].fill('I');
    const before = structuredClone(board);
    const result = clearFullRows(board);
    assert.equal(result.clearedRows, rows.length);
    assert.equal(result.board.length, BOARD_HEIGHT);
    assert.ok(result.board.every(row => row.length === BOARD_WIDTH));
    assert.deepEqual(result.board, [
      ...rows.map(() => Array(BOARD_WIDTH).fill(null)),
      ...before.filter((_, y) => !rows.includes(y)),
    ]);
    assert.deepEqual(board, before); // Pure helper does not mutate its input.
    result.board[0][1] = 'O';
    assert.deepEqual(board, before); // Nor alias input rows.
    if (rows.length > 1) assert.equal(result.board[1][1], null);
  });
}

test('downward lock completes a row, compacts, and reports exactly one clear', () => {
  const state = createInitialState(() => 'I');
  while (stepDown(state).moved) {}
  state.board[19].fill('J');
  for (let x = 3; x <= 6; x++) state.board[19][x] = null;
  state.board[18][0] = 'T';
  state.score = 123;
  let calls = 0;
  assert.deepEqual(descend(state, () => { calls++; return 'O'; }), {
    moved: false, locked: true, clearedRows: 1, spawned: true, spawnBlocked: false,
  });
  assert.equal(calls, 1);
  assert.equal(state.board[19][0], 'T');
  assert.equal(state.board.flat().filter(cell => cell !== null).length, 1);
  assert.deepEqual(state.active, createSpawnPiece('O'));
  assert.equal(state.score, 123); // Scoring belongs to task 8.
  assert.equal(lockPiece(state).clearedRows, 0);
});

test('clearing a top obstruction happens before next spawn placement', () => {
  const state = createInitialState(() => 'I');
  // Horizontal I at row zero is grounded by a partial row below it.
  state.board[0].fill('J');
  for (let x = 3; x <= 6; x++) state.board[0][x] = null;
  state.board[1][3] = 'T';
  assert.deepEqual(lockPiece(state, () => 'O'), {
    locked: true, clearedRows: 1, spawned: true, spawnBlocked: false,
  });
  assert.deepEqual(state.active, createSpawnPiece('O'));
  assert.ok(state.board[0].every(cell => cell === null));
  assert.equal(state.board[1][3], 'T');
});

test('unavailable lock does not clear existing full rows', () => {
  const state = createEmptyState();
  state.board[19].fill('J');
  const before = structuredClone(state);
  assert.equal(descend(state).clearedRows, 0);
  assert.deepEqual(state, before);
});
