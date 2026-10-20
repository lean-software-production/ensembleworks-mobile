import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, descend, moveDown, moveLeft, moveRight, rotateClockwise, LINE_POINTS } from '../src/model.js';
import { renderFrame } from '../src/render.js';

// Focused unit fixture: a vertical I fills the last gap in up to four rows.
function prepareClear(game, count) {
  for (const row of game.board) row.fill(null);
  rotateClockwise(game);
  for (let y = 20 - count; y < 20; y++) {
    game.board[y].fill('J');
    game.board[y][6] = null;
  }
  while (moveDown(game)) {}
}

for (const [count, points] of [0, 100, 300, 500, 800].entries()) {
  test(`${count} cleared lines award ${points} points once before spawn`, () => {
    let calls = 0;
    let game;
    game = createGame(() => {
      if (++calls > 1) assert.equal(game.score, points);
      return 'I';
    });
    assert.equal(game.score, 0);
    prepareClear(game, count);
    assert.equal(game.score, 0);
    assert.deepEqual(descend(game), { kind: 'locked', cleared: count, spawnBlocked: false });
    assert.equal(game.score, points);
    assert.equal(calls, 2);
    assert.deepEqual(descend(game), { kind: 'moved' });
    assert.equal(game.score, points);
    assert.match(renderFrame(game).split('\n')[22], new RegExp(`^Score: ${points}$`));
  });
}

test('successive locks accumulate, other actions and zero-line locks do not score', () => {
  const game = createGame(() => 'I');
  for (const count of [1, 4, 2, 3, 0]) {
    const before = game.score;
    prepareClear(game, count);
    assert.equal(moveDown(game), false);
    assert.equal(game.score, before);
    descend(game);
    assert.equal(game.score, before + LINE_POINTS[count]);
  }
  assert.equal(game.score, 1700);
  moveLeft(game);
  moveRight(game);
  rotateClockwise(game);
  while (moveLeft(game)) {}
  const snapshot = structuredClone(game);
  assert.equal(moveLeft(game), false);
  assert.deepEqual(game, snapshot);
  assert.equal(game.score, 1700);
});

test('large scores stay in one reserved row with bounded visible width', () => {
  const game = createGame(() => 'O');
  for (const score of [123456789012345, Number.MAX_VALUE, 10n ** 100n]) {
    game.score = score;
    for (const color of [false, true]) {
      const frame = renderFrame(game, { color }).replace(/\x1b\[[0-9;]*m/g, '');
      const rows = frame.split('\n');
      assert.equal(rows.length, 24);
      assert.equal(frame.endsWith('\n'), false);
      assert.ok(rows[22].length <= 22);
      assert.match(rows[22], /^Score: /);
      if (String(score).length > 15) assert.ok(rows[22].endsWith('…'));
    }
  }
});
