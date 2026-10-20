import {createGame,move,rotate,descend,restart} from './model.js';
import {render} from './render.js';
import {decoder} from './input.js';
export function startSession({input=process.stdin,output=process.stdout,signals=process,clock=globalThis,next,onFrame=()=>{},onError=()=>{process.exitCode=1;}}={}) {
  const game=createGame(next);
  let timer=null,closed=false,raw=false,entered=false;
  const interactive=!!(input.isTTY && output.isTTY);
  const cancel=()=>{if(timer!==null) clock.clearInterval(timer); timer=null;};
  function cleanup() {
    if(closed) return; closed=true; cancel();
    input.removeListener('data',receive); input.removeListener('end',cleanup); input.removeListener('error',fail);
    output.removeListener('resize',draw); output.removeListener('error',fail);
    for(const sig of ['SIGINT','SIGTERM','SIGHUP']) signals.removeListener(sig,cleanup);
    if(raw) {try{input.setRawMode(false);}catch{} raw=false;}
    if(interactive) input.pause();
    if(entered) {try{output.write('\x1b[0m\x1b[?25h\x1b[?1049l');}catch{} entered=false;}
  }
  function fail(error) {cleanup(); onError(error);}
  function draw() {
    if(closed) return;
    try {
      const frame=render(game,{color:interactive,columns:interactive?output.columns:52,rows:interactive?output.rows:24});
      output.write((interactive?'\x1b[H\x1b[2J':'')+frame); onFrame(frame,game);
    } catch(error) {fail(error);}
  }
  function schedule() {
    cancel();
    if(!closed && !game.over && !game.paused) timer=clock.setInterval(()=>{try{descend(game);scheduleIfOver();draw();}catch(e){fail(e);}},1000);
  }
  function scheduleIfOver(){if(game.over) cancel();}
  function dispatch(action) {
    if(closed) return;
    try {
      if(action==='quit') return cleanup();
      if(action==='pause' && !game.over) {game.paused=!game.paused;schedule();}
      else if(action==='restart' && game.over) {restart(game);schedule();}
      else if(action==='left') move(game,-1);
      else if(action==='right') move(game,1);
      else if(action==='rotate') rotate(game);
      else if(action==='down') {descend(game);scheduleIfOver();}
      draw();
    } catch(e) {fail(e);}
  }
  const receive=decoder(dispatch);
  try {
    if(!interactive) {draw(); cleanup();return {game,dispatch,cleanup};}
    input.on('data',receive); input.on('end',cleanup); input.on('error',fail);
    output.on('resize',draw); output.on('error',fail);
    for(const sig of ['SIGINT','SIGTERM','SIGHUP']) signals.on(sig,cleanup);
    raw=true; input.setRawMode(true); input.resume();
    entered=true; output.write('\x1b[?1049h\x1b[?25l');
    draw(); if(!closed) schedule();
  } catch(e) {fail(e);}
  return {game,dispatch,cleanup};
}
