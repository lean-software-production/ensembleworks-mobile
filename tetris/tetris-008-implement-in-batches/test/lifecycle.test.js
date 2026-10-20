import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, cellsOf, spawn, moveHorizontal, rotate, stepDown, lockPiece, clearLines, advance, restart, LINE_POINTS } from '../src/model.js';
import { render } from '../src/render.js';
const occupied = s => s.board.flat().filter(Boolean).length;
function ground(s) { while (stepDown(s).moved) {} }
function clearFixture(n) {
  const s = createState(() => 'I');
  rotate(s); // vertical I in column 5
  ground(s);
  for (let y = 20 - n; y < 20; y++) s.board[y] = Array.from({length:10}, (_, x) => x === 5 ? null : 'J');
  return s;
}

test('R06: separate lock copies exactly four identities, preserves others and cannot repeat', () => {
  const s = createState(() => 'T'); ground(s); s.board[5][0] = 'Z';
  const cells = cellsOf(s.active);
  assert.equal(lockPiece(s), true);
  assert.equal(occupied(s), 5);
  for (const [x,y] of cells) assert.equal(s.board[y][x], 'T');
  assert.equal(s.board[5][0], 'Z');
  assert.equal(lockPiece(s), false);
});

test('R06: move does not lock; obstruction locks once and spawns without advancing', () => {
  let calls = 0; const s = createState(() => { calls++; return calls === 1 ? 'O' : 'T'; });
  assert.deepEqual(advance(s), {moved:true, locked:false, cleared:0, points:0});
  assert.equal(occupied(s), 0); assert.equal(calls, 1);
  ground(s);
  assert.deepEqual(advance(s), {moved:false, locked:true, cleared:0, points:0});
  assert.equal(occupied(s), 4); assert.equal(calls, 2);
  assert.deepEqual(s.active, spawn('T'));
});

test('R07: zero through four clears, nonadjacent compaction, stable rows and independent empty rows', () => {
  for (let n = 0; n <= 4; n++) {
    const s = createState(() => 'O');
    const full = [2, 6, 12, 19].slice(0, n);
    for (let y = 0; y < 20; y++) s.board[y] = full.includes(y) ? Array(10).fill('I') : [String(y), ...Array(9).fill(null)];
    const survivors = s.board.filter((_, y) => !full.includes(y)).map(r => [...r]);
    assert.equal(clearLines(s.board), n);
    assert.equal(s.board.length, 20); assert.ok(s.board.every(r => r.length === 10));
    assert.deepEqual(s.board.slice(n), survivors);
    assert.ok(s.board.slice(0,n).every(r => r.every(c => c === null)));
    if (n > 1) { s.board[0][0] = 'Z'; assert.equal(s.board[1][0], null); }
  }
});

test('R07/R08: actual locks complete 0–4 rows and score once, including accumulation', () => {
  for (let n = 0; n <= 4; n++) {
    const s = clearFixture(n); s.score = 100;
    const result = advance(s);
    assert.equal(result.cleared, n); assert.equal(result.points, LINE_POINTS[n]);
    assert.equal(s.score, 100 + LINE_POINTS[n]);
    assert.equal(occupied(s), 4 - n);
    advance(s); moveHorizontal(s, -1); rotate(s); stepDown(s);
    assert.equal(s.score, 100 + LINE_POINTS[n]);
  }
  const s = clearFixture(4); advance(s);
  const second = clearFixture(2); s.board = second.board; s.active = second.active;
  advance(s); assert.equal(s.score, 1100);
});

test('R08: movement and rejection never score; huge scores fit status width and 24 rows', () => {
  const s = createState(() => 'O');
  for (let i=0;i<20;i++) moveHorizontal(s,-1);
  rotate(s); ground(s); stepDown(s);
  assert.equal(s.score,0); advance(s); assert.equal(s.score,0);
  s.score = 10n ** 100n;
  for (const color of [true,false]) {
    const rows = render(s,{color}).replace(/\x1b\[[0-9;]*m/g,'').split('\n');
    assert.equal(rows.length,24); assert.ok(rows.every(r=>r.length<=40));
  }
});

test('R09: obstructed spawn preserves settled cells; game-over actions inert; restart fresh', () => {
  let calls=0; const s=createState(()=>{calls++;return 'O';});
  ground(s); s.board[0][4]='Z';
  advance(s);
  assert.equal(s.status,'game-over'); assert.equal(s.active,null);
  assert.equal(s.board[0][4],'Z'); assert.equal(occupied(s),5); assert.equal(calls,2);
  const before=structuredClone(s);
  moveHorizontal(s,-1); moveHorizontal(s,1); rotate(s); stepDown(s); advance(s); lockPiece(s);
  assert.deepEqual(s,before); assert.equal(calls,2);
  const frame=render(s); assert.match(frame,/GAME OVER/); assert.match(frame,/restart; no keys/);
  assert.equal(frame.split('\n').length,24);
  s.score=800; restart(s);
  assert.equal(calls,3); assert.equal(occupied(s),0); assert.equal(s.score,0);
  assert.equal(s.status,'running'); assert.deepEqual(s.active,spawn('O'));
  assert.equal(render(s).split('\n').length,24);
});

test('R09: clearing happens before spawn decision, opening formerly blocked space', () => {
  const s=createState(()=>'O'); ground(s);
  // Boundary fixture: top full row must clear before the next spawn is tested.
  s.board[0]=Array(10).fill('Z');
  assert.equal(s.board[0][4],'Z');
  assert.equal(advance(s).cleared,1);
  assert.equal(s.status,'running'); assert.deepEqual(s.active,spawn('O'));
});

test('B03 legal fixture: O placements clear two lines, then central stacking reaches game over', () => {
  const s=createState(()=>'O');
  for (const target of [0,2,4,6,8]) {
    while(s.active.x!==target) assert.ok(moveHorizontal(s,Math.sign(target-s.active.x)));
    ground(s); advance(s);
  }
  assert.equal(s.score,300); assert.equal(occupied(s),0);
  let locks=0;
  while(s.status==='running' && locks<20) { ground(s); advance(s); locks++; }
  assert.equal(locks,10); assert.equal(s.status,'game-over');
  restart(s); assert.equal(s.status,'running'); assert.equal(s.score,0);
});
