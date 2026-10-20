import test from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_WIDTH, BOARD_HEIGHT, clearLines, createGame, moveDown, descend, spawnPiece } from '../src/model.js';

for (const count of [0, 1, 2, 3, 4]) {
  test(`stable compaction of ${count} completed rows`, () => {
    const board = Array.from({ length: BOARD_HEIGHT }, (_, y) => {
      const row = Array(BOARD_WIDTH).fill(null);
      row[y % BOARD_WIDTH] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'][y % 7];
      return row;
    });
    // Nonadjacent rows as well as a bottom row exercise stable filtering.
    const full = [19, 16, 9, 2].slice(0, count);
    for (const y of full) board[y].fill('Z');
    const before = structuredClone(board);
    const survivors = before.filter((_, y) => !full.includes(y));
    assert.equal(clearLines(board), count);
    assert.equal(board.length, BOARD_HEIGHT);
    assert.ok(board.every(row => row.length === BOARD_WIDTH));
    assert.deepEqual(board.slice(0, count), Array.from({ length: count }, () => Array(BOARD_WIDTH).fill(null)));
    assert.deepEqual(board.slice(count), survivors);
    assert.equal(new Set(board).size, BOARD_HEIGHT);
    const compacted = structuredClone(board);
    assert.equal(clearLines(board), 0);
    assert.deepEqual(board, compacted);
  });
}

for (const lines of [1, 2]) test(`descent locks to complete ${lines} rows before one spawn`, () => {
  let calls = 0;
  let game;
  game = createGame(() => {
    calls++;
    if (calls === 2) {
      assert.ok(game.board.slice(0, 19).every(row => row.every(cell => cell === null)));
      assert.equal(game.active, null);
    }
    return calls === 1 ? 'O' : 'T';
  });
  for (const y of (lines === 1 ? [19] : [18, 19])) {
    game.board[y].fill('J');
    game.board[y][4] = game.board[y][5] = null;
  }
  while (moveDown(game)) {}
  const board = game.board;
  assert.deepEqual(descend(game), { kind: 'locked', cleared: lines, spawnBlocked: false });
  assert.equal(game.board, board);
  assert.equal(calls, 2);
  assert.equal(game.score, lines === 1 ? 100 : 300);
  assert.deepEqual(game.active, spawnPiece('T'));
  assert.deepEqual(descend(game), { kind: 'moved' });
  assert.equal(calls, 2);
});

test('a row completed by locking clears before evaluating next spawn', () => {
  let calls = 0;
  const game = createGame(() => ++calls === 1 ? 'I' : 'O');
  // A focused model fixture: the top I completes a row and is supported below.
  game.board[0].fill('J');
  for (let x = 3; x <= 6; x++) game.board[0][x] = null;
  game.board[1][3] = 'Z';
  assert.deepEqual(descend(game), { kind: 'locked', cleared: 1, spawnBlocked: false });
  assert.deepEqual(game.active, spawnPiece('O'));
  assert.ok(game.board[0].every(cell => cell === null));
  assert.equal(game.board[1][3], 'Z');
  assert.equal(calls, 2);
});
