import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SHAPES,POINTS,source,sequence,createGame,cells,fits,move,rotate,step,lock,descend,clearLines,restart,emptyBoard} from '../src/model.js';
import {render,strip,COLORS} from '../src/render.js';
const game=t=>createGame(sequence([t]));
const snapshot=g=>JSON.stringify(g);
const settle=g=>{while(step(g));};
test('R01 R02: seven valid centered spawns, seeded generation, 24-row pure frames and palette',()=>{
  for(const t of Object.keys(SHAPES)) {
    const g=game(t),before=snapshot(g); assert.equal(new Set(cells(g.active).map(String)).size,4);assert(fits(g.board,g.active));
    const frame=render(g,{color:true});assert.equal(strip(frame).split('\n').length,24);assert(frame.includes(`\x1b[${COLORS[t]}m`));assert.equal(snapshot(g),before);
    assert(strip(frame).split('\n').every(r=>r.length<52));
  }
  assert.equal(new Set(Object.values(COLORS)).size,7);
  const a=source(123),b=source(123);const generated=Array.from({length:100},()=>a());assert.deepEqual(generated,Array.from({length:100},()=>b()));assert.equal(new Set(generated).size,7);
  const g=game('O');g.active=null;assert.equal(render(g).split('\n').length,24);assert(render(g).includes('Score: 0'));
});
test('R03 R05: movement, both walls, settled obstacles and blocked primitive does not lock',()=>{
  const g=game('O');assert(move(g,-1));assert.equal(g.active.x,3);assert(move(g,1));
  while(move(g,-1)); assert.equal(g.active.x,0);const before=snapshot(g);assert(!move(g,-1));assert.equal(snapshot(g),before);
  while(move(g,1));assert.equal(g.active.x,8);
  g.board[0][7]='T';assert(!move(g,-1));
  assert(step(g));assert.equal(g.active.y,1);settle(g);assert.equal(g.active.y,18);
  const floor=snapshot(g);assert(!step(g));assert.equal(snapshot(g),floor);assert.equal(g.board.flat().filter(Boolean).length,1);
  const h=game('O');h.board[2][4]='T';const initial=snapshot(h);assert(!step(h));assert.equal(snapshot(h),initial);
});
test('R04: rotation cycles and rejected wall/floor/settled rotations preserve state',()=>{
  for(const t of Object.keys(SHAPES)) {const g=game(t),before=snapshot(g);for(let i=0;i<4;i++){assert(rotate(g));assert.equal(new Set(cells(g.active).map(String)).size,4);}assert.equal(snapshot(g),before);}
  const g=game('I');rotate(g);while(move(g,-1));let before=snapshot(g);assert(!rotate(g));assert.equal(snapshot(g),before);
  const h=game('I');settle(h);before=snapshot(h);assert(!rotate(h));assert.equal(snapshot(h),before);
  const j=game('T');j.board[2][4]='O';before=snapshot(j);assert(!rotate(j));assert.equal(snapshot(j),before);
});
test('R06: separate lock, one next piece and no same-action fall',()=>{
  let n=0;const g=createGame(()=>{n++;return 'O';});assert(descend(g).moved);assert.equal(n,1);assert.equal(g.board.flat().filter(Boolean).length,0);
  settle(g);g.board[19][0]='T';assert(descend(g).locked);assert.equal(n,2);assert.equal(g.active.y,0);assert.equal(g.board.flat().filter(Boolean).length,5);assert.equal(g.board[19][0],'T');
  const h=game('T');assert(lock(h));assert.equal(h.board.flat().filter(Boolean).length,4);assert(!lock(h));
});
test('R07: zero through four, nonadjacent clears, stable order and dimensions',()=>{
  for(let count=0;count<=4;count++) {const b=emptyBoard();b[5][0]='J';b[10][1]='L';for(let i=0;i<count;i++)b[19-i*2].fill('I');const r=clearLines(b);assert.equal(r.count,count);assert.equal(r.board.length,20);assert(r.board.every(row=>row.length===10));assert.equal(r.board[5+count][0],'J');assert.equal(r.board[10+count][1],'L');assert(r.board.slice(0,count).flat().every(c=>!c));}
});
test('R07 R08: lock clears 1–4, scoring once, accumulation and no movement points',()=>{
  for(let count=1;count<=4;count++) {
    const g=game('I');rotate(g);g.active.x=2;g.active.y=16;
    for(let y=20-count;y<20;y++) {g.board[y].fill('T');g.board[y][4]=null;}
    assert(fits(g.board,g.active));let result=descend(g);assert.equal(result.cleared,count);assert.equal(g.score,POINTS[count]);
    move(g,-1);rotate(g);step(g);assert.equal(g.score,POINTS[count]);
  }
  const g=game('O');for(let i=0;i<2;i++){g.board=emptyBoard();for(let y=18;y<20;y++){g.board[y].fill('J');g.board[y][4]=g.board[y][5]=null;}g.active.x=4;g.active.y=18;assert.equal(descend(g).cleared,2);}assert.equal(g.score,600);
  const h=game('O');settle(h);descend(h);assert.equal(h.score,0);
  h.score=1e100;h.over=true;h.active=null;assert.equal(render(h).split('\n').length,24);assert(render(h).includes('r restart'));
});
test('R09: blocked spawn, inert over state, restart, clear before spawn',()=>{
  const g=game('O');settle(g);g.board[0][4]='T';const before=g.board[0][4];descend(g);assert(g.over);assert.equal(g.active,null);assert.equal(g.board[0][4],before);
  const end=snapshot(g);move(g,1);rotate(g);descend(g);assert.equal(snapshot(g),end);restart(g);assert(!g.over);assert.equal(g.score,0);assert.equal(g.board.flat().filter(Boolean).length,0);assert(fits(g.board,g.active));
  // Full top rows are compacted away before next spawn is tested.
  const h=game('O');settle(h);h.board[0].fill('T');h.board[1].fill('T');assert.equal(descend(h).cleared,2);assert(!h.over);
});
