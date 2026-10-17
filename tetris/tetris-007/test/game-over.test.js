import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState, createSpawnPiece, descend, lockPiece, moveLeft, moveRight,
  restart, rotateClockwise, stepDown,
} from '../src/model.js';
import { renderFrame } from '../src/render.js';

function grounded() {
  const state = createInitialState(() => 'O');
  while (stepDown(state).moved) {}
  return state;
}

test('blocked next spawn loses without overwriting board or earned score; gameplay freezes', () => {
  const state = grounded();
  state.board[0][4] = 'J';
  state.board[19].fill('I');
  state.board[19][4] = state.board[19][5] = null;
  state.score = 300;
  // Row zero moves down on clear, still obstructing the O spawn at row one.
  let calls = 0;
  const source = () => { calls++; return 'O'; };
  assert.equal(descend(state, source).spawnBlocked, true);
  assert.equal(calls, 1);
  assert.equal(state.status, 'game-over');
  assert.equal(state.active, null);
  assert.equal(state.board[1][4], 'J');
  assert.equal(state.score, 400);
  const before = structuredClone(state);
  for (const action of [moveLeft, moveRight, rotateClockwise, stepDown, descend, lockPiece]) {
    action(state, () => { throw Error('must not consume'); });
    assert.deepEqual(state, before);
  }
});

test('clear opens spawn space before game-over decision', () => {
  const state = grounded();
  state.board[0].fill('J');
  const result = descend(state, () => 'O');
  assert.equal(result.clearedRows, 1);
  assert.equal(result.spawned, true);
  assert.equal(result.spawnBlocked, false);
  assert.equal(state.status, 'running');
  assert.deepEqual(state.active, createSpawnPiece('O'));
  assert.equal(state.score, 100);
});

test('unblocked lock continues and restart is a no-op outside game over', () => {
  const state = grounded();
  assert.equal(descend(state, () => 'T').spawned, true);
  assert.equal(state.status, 'running');
  for (const status of ['running', 'paused']) {
    state.status = status;
    const before = structuredClone(state);
    assert.deepEqual(restart(state, () => { throw Error('must not consume'); }), { restarted: false });
    assert.deepEqual(state, before);
  }
});

test('restart resets all gameplay state using one fresh type from the same source', () => {
  const types = ['O', 'O', 'T'];
  const source = () => types.shift();
  const state = createInitialState(source);
  while (stepDown(state).moved) {}
  state.board[0][4] = 'J';
  state.score = 800;
  descend(state, source);
  assert.equal(state.status, 'game-over');
  assert.deepEqual(restart(state, source), { restarted: true });
  assert.deepEqual(state, createInitialState(() => 'T'));
  assert.deepEqual(types, []);
});

test('running and game-over frames expose relevant controls within 24 by 40', () => {
  const state = grounded();
  state.score = 10n ** 100n;
  for (const status of ['running', 'game-over']) {
    state.status = status;
    if (status === 'game-over') state.active = null;
    const before = structuredClone(state);
    const frame = renderFrame(state);
    const rows = frame.replace(/\x1b\[[0-9;]*m/g, '').split('\n');
    assert.equal(rows.length, 24);
    assert.ok(rows.every(row => row.length <= 40));
    assert.ok(!frame.endsWith('\n'));
    assert.match(rows[22], status === 'running' ? /Running/ : /Game over/);
    assert.match(rows[23], status === 'running' ? /Arrows:.*P:pause Q:quit/ : /R:restart Q:quit/);
    assert.equal(rows[23].includes('R:restart'), status === 'game-over');
    assert.deepEqual(state, before);
  }
});
