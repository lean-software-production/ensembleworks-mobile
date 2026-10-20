import {cells} from './model.js';
export const COLORS={I:96,O:93,T:95,S:92,Z:91,J:94,L:33};
export const strip = text => text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g,'');
export const WIDTH=52;
export function render(g,{color=false,columns=WIDTH,rows=24}={}) {
  columns=Math.max(0,Math.floor(columns)); rows=Math.max(0,Math.floor(rows));
  if(columns<WIDTH || rows<24) return rows && columns ? 'Need 52x24 terminal'.slice(0,Math.max(0,columns-1)) : '';
  const paint=(s,n)=>color?`\x1b[${n}m${s}\x1b[0m`:s;
  const board=g.board.map(row=>[...row]);
  if(g.active) for(const [x,y] of cells(g.active)) board[y][x]=g.active.type;
  const border=paint('+'+'-'.repeat(20)+'+',94);
  const frame=[border,...board.map(row=>paint('|',94)+row.map(t=>t?paint('[]',COLORS[t]):' .').join('')+paint('|',94)),border];
  const state=g.over?'GAME OVER - r restart':g.paused?'PAUSED':'RUNNING';
  frame.push(paint(`Score: ${String(g.score).slice(0,18)}  ${state}`.slice(0,WIDTH-1),93));
  frame.push(paint('Arrows: move/up rotate/down drop | p pause | q quit',96));
  return frame.join('\n');
}
