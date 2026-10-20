import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, moveDown, descend, moveLeft, moveRight, rotateClockwise,
  lockPiece, restartGame, spawnPiece, canPlace } from '../src/model.js';
import { renderFrame } from '../src/render.js';

function fixture() {
  let calls = 0;
  const game = createGame(() => ['O', 'I', 'T'][calls++ % 3]);
  while (moveDown(game)) {}
  return { game, calls: () => calls };
}

test('blocked next spawn ends play without overwriting cells or allowing further actions', () => {
  const { game, calls } = fixture();
  game.board[0][3] = 'Z';
  assert.deepEqual(descend(game), { kind: 'locked', cleared: 0, spawnBlocked: true });
  assert.equal(game.status, 'game-over');
  assert.equal(game.active, null);
  assert.equal(game.board[0][3], 'Z');
  const before = structuredClone(game);
  for (let i = 0; i < 3; i++) {
    for (const action of [moveLeft, moveRight, rotateClockwise, moveDown, lockPiece]) {
      assert.equal(action(game), false);
    }
    assert.deepEqual(descend(game), { kind: 'ignored' });
  }
  assert.deepEqual(game, before);
  assert.equal(calls(), 2);
});

test('unblocked spawn stays running and clearing opens spawn before the decision', () => {
  for (const clear of [false, true]) {
    const { game } = fixture();
    if (clear) game.board[0].fill('Z');
    const result = descend(game);
    assert.equal(result.spawnBlocked, false);
    assert.equal(result.cleared, Number(clear));
    assert.equal(game.score, clear ? 100 : 0);
    assert.equal(game.status, 'running');
    assert.deepEqual(game.active, spawnPiece('I'));
    assert.equal(canPlace(game.board, game.active), true);
  }
});

test('restart resets the finished game in place and continues its injected source', () => {
  const { game, calls } = fixture();
  assert.equal(restartGame(game), false);
  assert.equal(calls(), 1);
  game.board[0][3] = 'Z';
  descend(game);
  game.score = 800;
  const oldBoard = game.board;
  assert.equal(restartGame(game), true);
  assert.equal(calls(), 3);
  assert.notEqual(game.board, oldBoard);
  assert.ok(game.board.every(row => row.length === 10 && row.every(cell => cell === null)));
  assert.equal(game.board.length, 20);
  assert.equal(game.score, 0);
  assert.equal(game.status, 'running');
  assert.deepEqual(game.active, spawnPiece('T'));
  assert.equal(canPlace(game.board, game.active), true);
  assert.deepEqual(descend(game), { kind: 'moved' });
  assert.equal(calls(), 3);
});

test('running and finished plain/ANSI frames stay at 24 rows with appropriate controls', () => {
  const { game } = fixture();
  for (const status of ['running', 'game-over']) {
    game.status = status;
    if (status === 'game-over') game.active = null;
    for (const color of [false, true]) {
      const before = structuredClone(game);
      const frame = renderFrame(game, { color });
      const plain = frame.replace(/\x1b\[[0-9;]*m/g, '');
      assert.equal(plain.split('\n').length, 24);
      assert.equal(plain.endsWith('\n'), false);
      assert.match(plain, /Score: 0/);
      assert.match(plain, /q quit/);
      if (status === 'game-over') {
        assert.match(plain, /Game over/);
        assert.match(plain, /r restart/);
      } else assert.match(plain, /Up rotate/);
      assert.deepEqual(game, before);
    }
  }
});
