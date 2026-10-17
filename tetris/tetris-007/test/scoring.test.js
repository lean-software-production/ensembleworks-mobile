import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState, createSpawnPiece, descend, lockPiece,
  moveLeft, moveRight, rotateClockwise, stepDown,
} from '../src/model.js';
import { renderFrame } from '../src/render.js';

// A legal grounded vertical I fills one hole in each of the bottom four rows.
function prepareClear(state, count) {
  state.board = Array.from({ length: 20 }, () => Array(10).fill(null));
  state.active = { ...createSpawnPiece('I'), x: 2, y: 16,
    cells: [[1, 0], [1, 1], [1, 2], [1, 3]] };
  for (let y = 20 - count; y < 20; y++) {
    state.board[y].fill('J');
    state.board[y][3] = null;
  }
}

for (const [count, points] of [0, 100, 300, 500, 800].entries()) {
  test(`${count}-line lock awards ${points} exactly once`, () => {
    const state = createInitialState(() => 'I');
    assert.equal(state.score, 0);
    prepareClear(state, count);
    const result = descend(state, () => 'T');
    assert.equal(result.locked, true);
    assert.equal(result.clearedRows, count);
    assert.equal(state.score, points);
    assert.equal(lockPiece(state).locked, false);
    assert.equal(state.score, points);
    const frame = renderFrame(state).replace(/\x1b\[[0-9;]*m/g, '');
    assert.match(frame.split('\n')[22], new RegExp(`Score: ${points}  `));
  });
}

test('successive clears accumulate their simultaneous-clear awards', () => {
  const state = createInitialState(() => 'I');
  for (const count of [2, 1, 4, 3, 0]) {
    prepareClear(state, count);
    lockPiece(state, () => 'O');
  }
  assert.equal(state.score, 1700);
});

test('movement, rejection, rotation and ordinary downward actions award nothing', () => {
  const state = createInitialState(() => 'T');
  state.score = 300;
  assert.equal(moveLeft(state).moved, true);
  assert.equal(moveRight(state).moved, true);
  assert.equal(rotateClockwise(state).rotated, true);
  assert.equal(stepDown(state).moved, true);
  assert.equal(descend(state).moved, true);
  while (moveLeft(state).moved) {}
  assert.equal(moveLeft(state).moved, false);
  while (stepDown(state).moved) {}
  assert.equal(stepDown(state).moved, false);
  assert.equal(state.score, 300);
  assert.equal(descend(state, () => 'O').clearedRows, 0);
  assert.equal(state.score, 300);
});

test('blocked next spawn preserves the points just earned', () => {
  const state = createInitialState(() => 'I');
  prepareClear(state, 1);
  state.board[0][4] = 'J';
  // After one clear the obstruction moves to row 1, blocking O.
  const result = lockPiece(state, () => 'O');
  assert.equal(result.spawnBlocked, true);
  assert.equal(state.score, 100);
});

test('huge live score is abbreviated without changing state or frame bounds', () => {
  const state = createInitialState(() => 'T');
  state.score = 1e100;
  const before = structuredClone(state);
  const rows = renderFrame(state).replace(/\x1b\[[0-9;]*m/g, '').split('\n');
  assert.equal(rows.length, 24);
  assert.ok(rows.every(row => row.length <= 40));
  assert.deepEqual(state, before);
});
