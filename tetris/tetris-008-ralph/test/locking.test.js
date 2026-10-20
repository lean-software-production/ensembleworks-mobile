import test from 'node:test';
import assert from 'node:assert/strict';
import { PIECE_TYPES, createGame, activeCells, moveDown, lockPiece, descend, spawnPiece, canPlace } from '../src/model.js';

function sequence(types) {
  let calls = 0;
  const game = createGame(() => types[calls++ % types.length]);
  return { game, calls: () => calls };
}

 test('separate locking settles exactly four cells once, preserving all others', () => {
  for (const type of PIECE_TYPES) {
    const { game, calls } = sequence([type]);
    game.board[10][0] = 'Z';
    while (moveDown(game)) {}
    const before = structuredClone(game.board);
    const cells = activeCells(game.active);
    const board = game.board;
    assert.equal(lockPiece(game), true);
    for (const [x, y] of cells) before[y][x] = type;
    assert.deepEqual(game.board, before);
    assert.equal(game.board, board);
    assert.equal(game.active, null);
    assert.equal(lockPiece(game), false);
    assert.deepEqual(game.board, before);
    assert.equal(calls(), 1);
    assert.equal(game.score, 0);
  }
});

test('composed descent moves without locking or consuming a piece', () => {
  const { game, calls } = sequence(['T', 'O']);
  const before = structuredClone(game);
  assert.deepEqual(descend(game), { kind: 'moved' });
  assert.deepEqual(game, { ...before, active: { ...before.active, y: 1 } });
  assert.equal(calls(), 1);
});

test('floor and settled obstructions lock once and spawn exactly one centered piece', () => {
  for (const obstruction of [false, true]) {
    const { game, calls } = sequence(['O', 'I', 'T']);
    if (obstruction) game.board[8][4] = 'Z';
    while (moveDown(game)) {}
    const cells = activeCells(game.active);
    assert.deepEqual(descend(game), { kind: 'locked', spawnBlocked: false });
    assert.equal(calls(), 2);
    assert.deepEqual(game.active, spawnPiece('I'));
    assert.equal(canPlace(game.board, game.active), true);
    for (const [x, y] of cells) assert.equal(game.board[y][x], 'O');
    const board = structuredClone(game.board);
    assert.deepEqual(descend(game), { kind: 'moved' });
    assert.equal(game.active.y, 1);
    assert.equal(calls(), 2);
    assert.deepEqual(game.board, board);
  }
});

test('blocked spawn is explicit, nonoverlapping, and cannot repeat the lock', () => {
  const { game, calls } = sequence(['O', 'I']);
  while (moveDown(game)) {}
  game.board[0][3] = 'Z';
  const expected = structuredClone(game.board);
  for (const [x, y] of activeCells(game.active)) expected[y][x] = 'O';
  assert.deepEqual(descend(game), { kind: 'locked', spawnBlocked: true });
  assert.equal(game.active, null);
  assert.deepEqual(game.board, expected);
  assert.equal(calls(), 2);
  const before = structuredClone(game);
  assert.deepEqual(descend(game), { kind: 'ignored' });
  assert.equal(lockPiece(game), false);
  assert.deepEqual(game, before);
  assert.equal(calls(), 2);
});

test('unavailable or invalid pieces cannot lock or progress', () => {
  for (const status of ['paused', 'game-over', 'running']) {
    const { game, calls } = sequence(['T']);
    game.status = status;
    if (status === 'running') game.board[0][4] = 'Z';
    const before = structuredClone(game);
    assert.equal(lockPiece(game), false);
    assert.deepEqual(descend(game), { kind: 'ignored' });
    assert.deepEqual(game, before);
    assert.equal(calls(), 1);
  }
});
