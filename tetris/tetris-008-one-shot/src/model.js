export const SHAPES = {
  I: [[0,1],[1,1],[2,1],[3,1]], O: [[0,0],[1,0],[0,1],[1,1]],
  T: [[1,0],[0,1],[1,1],[2,1]], S: [[1,0],[2,0],[0,1],[1,1]],
  Z: [[0,0],[1,0],[1,1],[2,1]], J: [[0,0],[0,1],[1,1],[2,1]], L: [[2,0],[0,1],[1,1],[2,1]]
};
export const POINTS = [0,100,300,500,800];
export const emptyBoard = () => Array.from({length:20}, () => Array(10).fill(null));
export function source(seed) {
  let n = Number(seed) >>> 0;
  return () => { n = (1664525*n + 1013904223) >>> 0; return Object.keys(SHAPES)[Math.floor(n/4294967296*7)]; };
}
export function sequence(types) {
  let i=0;
  if (!types.length || types.some(t=>!SHAPES[t])) throw Error('Invalid piece sequence');
  return () => types[i++ % types.length];
}
export const cells = p => p.cells.map(([x,y])=>[x+p.x,y+p.y]);
export function fits(board,p) {
  return cells(p).every(([x,y])=>x>=0 && x<10 && y>=0 && y<20 && !board[y][x]);
}
export function spawn(g) {
  const type=g.next();
  if (!SHAPES[type]) throw Error('Invalid piece');
  const p={type,x:type==='O'?4:3,y:0,cells:SHAPES[type].map(c=>[...c])};
  g.over=!fits(g.board,p); g.active=g.over?null:p;
}
export function createGame(next=()=>Object.keys(SHAPES)[Math.floor(Math.random()*7)]) {
  const g={board:emptyBoard(),active:null,score:0,over:false,paused:false,next}; spawn(g); return g;
}
export function restart(g) {
  Object.assign(g,{board:emptyBoard(),active:null,score:0,over:false,paused:false}); spawn(g);
}
export function move(g,dx,dy=0) {
  if(g.over || g.paused || !g.active) return false;
  const p={...g.active,x:g.active.x+dx,y:g.active.y+dy};
  if(!fits(g.board,p)) return false;
  g.active=p; return true;
}
export const step = g => move(g,0,1);
export function rotate(g) {
  if(g.over || g.paused || !g.active) return false;
  const p=g.active, size=p.type==='I'?4:3;
  const rotated={...p,cells:p.type==='O'?p.cells:p.cells.map(([x,y])=>[size-1-y,x])};
  if(!fits(g.board,rotated)) return false;
  g.active=rotated; return true;
}
export function lock(g) {
  if(g.over || g.paused || !g.active || !fits(g.board,g.active)) return false;
  for(const [x,y] of cells(g.active)) g.board[y][x]=g.active.type;
  g.active=null; return true;
}
export function clearLines(board) {
  const kept=board.filter(row=>row.some(c=>!c));
  const count=20-kept.length;
  return {count,board:[...Array.from({length:count},()=>Array(10).fill(null)),...kept]};
}
export function descend(g) {
  if(g.over || g.paused || !g.active) return {moved:false,locked:false,cleared:0};
  if(step(g)) return {moved:true,locked:false,cleared:0};
  lock(g);
  const {count,board}=clearLines(g.board); g.board=board; g.score+=POINTS[count]; spawn(g);
  return {moved:false,locked:true,cleared:count};
}
