import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { SHAPES, TYPES, createState, spawn, pieceSource, cellsOf, canPlace, moveHorizontal, rotate, stepDown } from '../src/model.js';
import { render, PALETTE } from '../src/render.js';
const state = (type = 'T') => createState(() => type);
const geometry = p => p.cells.map(c => c.join(',')).sort();

test('R01: pure empty frame and actual bounded npm launch', () => {
  const s = state(); s.active = null;
  const before = structuredClone(s);
  const frame = render(s);
  assert.equal(frame.split('\n').length, 24);
  assert.equal(frame.split('\n').filter(r => /^\|.*\|$/.test(r)).length, 20);
  assert.match(frame, /Score: 0/);
  assert.equal(frame.split('\n')[23], 'Model: left/right, rotate, down; no keys');
  assert.deepEqual(s, before);
  const run = spawnSync('npm', ['start', '--silent'], { encoding: 'utf8', timeout: 5000 });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.split('\n').length, 24);
  assert.equal(run.stdout.includes('\x1b'), false);
  assert.equal(run.stdout.split('\n')[23], 'Model: left/right, rotate, down; no keys');
});

test('R02: seven deterministic valid centered spawns and retro palette', () => {
  let i = 0;
  const next = pieceSource(() => (i++ + 0.5) / 7);
  assert.deepEqual(TYPES.map(() => next()), TYPES);
  assert.equal(new Set(Object.values(PALETTE)).size, 7);
  for (const type of TYPES) {
    const s = state(type);
    assert.equal(SHAPES[type].length, 4);
    assert.equal(new Set(geometry(s.active)).size, 4);
    assert.ok(canPlace(s.board, s.active));
    const xs = cellsOf(s.active).map(c => c[0]);
    assert.ok(Math.abs(Math.min(...xs) - (9 - Math.max(...xs))) <= 1);
    assert.equal(render(s).match(/\[\]/g).length, 4);
    const colored = render(s, { color: true });
    assert.ok(colored.includes(`\x1b[${PALETTE[type]}m`));
    assert.equal(colored.replace(/\x1b\[[0-9;]*m/g, '').split('\n').length, 24);
  }
});

test('R03: horizontal movement, both walls, settled collisions, no self collision', () => {
  const s = state(); const x = s.active.x;
  assert.ok(moveHorizontal(s, -1)); assert.equal(s.active.x, x - 1);
  assert.ok(moveHorizontal(s, 1)); assert.equal(s.active.x, x);
  for (const direction of [-1, 1]) {
    for (let i = 0; i < 30; i++) moveHorizontal(s, direction);
    assert.ok(canPlace(s.board, s.active));
    const before = structuredClone(s);
    assert.equal(moveHorizontal(s, direction), false); assert.deepEqual(s, before);
  }
  const blocked = state('O'); blocked.board[0][blocked.active.x - 1] = 'J';
  const before = structuredClone(blocked);
  assert.equal(moveHorizontal(blocked, -1), false); assert.deepEqual(blocked, before);
});

test('R04: four rotations restore every geometry; O is invariant', () => {
  for (const type of TYPES) {
    const s = state(type); const original = geometry(s.active);
    for (let i = 0; i < 4; i++) {
      assert.ok(rotate(s)); assert.equal(new Set(geometry(s.active)).size, 4);
      assert.ok(canPlace(s.board, s.active));
      if (type === 'O') assert.deepEqual(geometry(s.active), original);
    }
    assert.deepEqual(geometry(s.active), original);
  }
});

test('R04: wall, floor and settled rotation rejection preserves exact state', () => {
  const wall = state('I'); rotate(wall);
  while (moveHorizontal(wall, -1)) {} // vertical I can place its box beyond left wall
  const floor = state('I'); while (stepDown(floor).moved) {}
  const settled = state('T'); settled.board[2][settled.active.x + 1] = 'Z';
  for (const s of [wall, floor, settled]) {
    const before = structuredClone(s);
    assert.equal(rotate(s), false); assert.deepEqual(s, before);
  }
});

test('R05: down moves one row, stops at first obstruction without locks or generation', () => {
  for (const obstructed of [false, true]) {
    let calls = 0; const s = createState(() => { calls++; return 'O'; });
    if (obstructed) s.board[8][s.active.x] = 'L';
    const board = structuredClone(s.board);
    assert.deepEqual(stepDown(s), { moved: true, blocked: false }); assert.equal(s.active.y, 1);
    while (stepDown(s).moved) {}
    assert.equal(s.active.y, obstructed ? 6 : 18);
    const before = structuredClone(s);
    for (let i = 0; i < 5; i++) assert.deepEqual(stepDown(s), { moved: false, blocked: true });
    assert.deepEqual(s, before); assert.deepEqual(s.board, board); assert.equal(calls, 1);
  }
});
