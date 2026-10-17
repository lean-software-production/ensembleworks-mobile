import test from 'node:test';
import assert from 'node:assert/strict';
import { TETROMINOES, PIECE_TYPES, createInitialState, createRandomTypeSource, activeCells } from '../src/model.js';
import { renderFrame } from '../src/render.js';

for (const type of PIECE_TYPES) {
  test(`${type}: four distinct frame cells spawn centered in an empty board`, () => {
    const shape = TETROMINOES[type];
    assert.equal(shape.cells.length, 4);
    assert.equal(new Set(shape.cells.map(String)).size, 4);
    assert.equal(shape.size, type === 'I' ? 4 : type === 'O' ? 2 : 3);
    assert.ok(shape.cells.every(([x, y]) => x >= 0 && x < shape.size && y >= 0 && y < shape.size));
    let calls = 0;
    const state = createInitialState(() => { calls++; return type; });
    assert.equal(calls, 1);
    const cells = activeCells(state.active);
    assert.ok(cells.every(([x, y]) => x >= 0 && x < 10 && y >= 0 && y < 20));
    const xs = cells.map(([x]) => x);
    assert.equal(Math.min(...xs), Math.floor((10 - (Math.max(...xs) - Math.min(...xs) + 1)) / 2));
    assert.equal(Math.min(...cells.map(([, y]) => y)), 0);
    assert.ok(state.board.flat().every(cell => cell === null));
    assert.equal(state.score, 0);
    assert.equal(state.status, 'running');
    const before = structuredClone(state);
    const frame = renderFrame(state);
    assert.equal(renderFrame(state), frame);
    assert.deepEqual(state, before);
    assert.equal(calls, 1);
    const rows = frame.replace(/\x1b\[[0-9;]*m/g, '').split('\n');
    assert.equal(rows.length, 24);
    assert.ok(rows.every(row => row.length <= 40));
    assert.equal((rows.join('').match(/\[\]/g) ?? []).length, 4);
    assert.equal((rows.join('').match(/ \./g) ?? []).length, 196);
    state.active.cells[0][0] = 99;
    assert.notEqual(shape.cells[0][0], 99);
  });
}

test('scripted generation exercises all seven types in order', () => {
  const script = [...PIECE_TYPES];
  const source = () => script.shift();
  assert.deepEqual(PIECE_TYPES.map(() => createInitialState(source).active.type), PIECE_TYPES);
  assert.equal(script.length, 0);
});

test('uniform source maps the seven equal intervals independently', () => {
  const samples = PIECE_TYPES.map((_, i) => (i + 0.5) / 7);
  samples.push(0, 1 - Number.EPSILON, 0);
  const source = createRandomTypeSource(() => samples.shift());
  assert.deepEqual(PIECE_TYPES.map(() => source()), PIECE_TYPES);
  assert.deepEqual([source(), source(), source()], ['I', 'L', 'I']);
  assert.throws(() => createRandomTypeSource(() => 1)(), RangeError);
  assert.throws(() => createInitialState(() => 'invalid'), RangeError);
});
