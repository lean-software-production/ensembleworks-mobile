import test from 'node:test';
import assert from 'node:assert/strict';
import { SHAPES, PIECE_TYPES, createGame, createPieceSource, seededRandom, activeCells, spawnPiece } from '../src/model.js';
import { renderFrame, PALETTE } from '../src/render.js';

test('all seven shapes spawn centered, valid, separate and visibly bounded', () => {
  assert.equal(PIECE_TYPES.length, 7);
  assert.equal(new Set(Object.values(PALETTE)).size, 7);
  for (const type of PIECE_TYPES) {
    assert.equal(SHAPES[type].length, 4);
    assert.equal(new Set(SHAPES[type].map(String)).size, 4);
    let calls = 0;
    const game = createGame(() => { calls++; return type; });
    assert.equal(calls, 1);
    assert.equal(game.score, 0);
    assert.equal(game.status, 'running');
    assert.equal(game.board.length, 20);
    assert.equal(new Set(game.board).size, 20);
    assert.ok(game.board.every(row => row.length === 10 && row.every(cell => cell === null)));
    const cells = activeCells(game.active);
    assert.ok(cells.every(([x, y]) => x >= 0 && x < 10 && y >= 0 && y < 20));
    const xs = cells.map(([x]) => x);
    assert.ok(Math.abs(Math.min(...xs) - (9 - Math.max(...xs))) <= 1);
    const before = structuredClone(game);
    for (const color of [false, true]) {
      const frame = renderFrame(game, { color });
      const plain = frame.replace(/\x1b\[[0-9;]*m/g, '');
      assert.equal(plain.split('\n').length, 24);
      assert.equal(plain.endsWith('\n'), false);
      assert.equal((plain.match(/\[\]/g) ?? []).length, 4);
      assert.ok(plain.split('\n').slice(0, 22).every(row => row.length === 22));
      if (color) {
        assert.ok(frame.includes(`\x1b[${PALETTE[type]}m[]\x1b[0m`));
        assert.ok(frame.endsWith('Controls: <-/-> move | Up rotate | Down drop | p pause | q quit'));
      }
    }
    assert.deepEqual(game, before);
    game.active.cells[0][0] = 99;
    assert.notEqual(spawnPiece(type).cells[0][0], 99);
  }
});

test('piece source accepts controlled randomness and seeds reproduce all types', () => {
  let index = 0;
  const source = createPieceSource(() => index++ / 7);
  assert.deepEqual(PIECE_TYPES.map(() => source()), PIECE_TYPES);
  const a = createPieceSource(seededRandom(42));
  const b = createPieceSource(seededRandom(42));
  const sequence = Array.from({ length: 100 }, () => a());
  assert.deepEqual(sequence, Array.from({ length: 100 }, () => b()));
  assert.deepEqual(new Set(sequence), new Set(PIECE_TYPES));
  for (const bad of [-1, 1, NaN, Infinity]) {
    assert.throws(createPieceSource(() => bad), RangeError);
  }
  assert.throws(() => spawnPiece('invalid'), RangeError);
});
