import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startSession} from '../src/session.js';
import {sequence,step} from '../src/model.js';
import {decoder} from '../src/input.js';
import {strip} from '../src/render.js';
import {Clock,terminal} from './helpers.js';
test('R11 decoder handles combined/split arrows, unknown CSI and keys',()=>{
  const actions=[],receive=decoder(a=>actions.push(a));receive(Buffer.from('\x1b'));receive('[D\x1b[');receive('C\x1b[A\x1b[Bpxr\x1b[99~q');assert.deepEqual(actions,['left','right','rotate','down','pause','restart','quit']);
});
test('R11 unsupported Alt/SS3 never dispatches trailing bindings across chunk boundaries',()=>{
  for(const sequence of ['\x1bp','\x1bq','\x1br','\x1bOp','\x1bOq','\x1bOr','\x1bO1;2p']) {
    for(let split=0;split<=sequence.length;split++) {
      const actions=[],receive=decoder(a=>actions.push(a));
      receive(Buffer.from(sequence.slice(0,split)));
      receive(Buffer.from(sequence.slice(split)+'\x1bODp\x1bOCq'));
      assert.deepEqual(actions,['left','pause','right','quit']);
    }
  }
});
test('R11 session ignores combined and split unsupported Alt/SS3 then accepts valid controls',()=>{
  for(const chunks of [['\x1bp\x1bq\x1br'],['\x1b','p\x1b','q\x1b','r'],['\x1bOp\x1bOq\x1bOr'],['\x1b','Op\x1bO','q\x1b','O','r']]) {
    const io=terminal(),clock=new Clock();
    const s=startSession({...io,clock,next:sequence(['O'])});
    const before=JSON.stringify(s.game);
    for(const chunk of chunks)io.input.emit('data',Buffer.from(chunk));
    assert.equal(JSON.stringify(s.game),before);
    assert.equal(clock.timers.size,1);
    assert(io.input.isRaw);
    assert.equal(io.input.listenerCount('data'),1);
    io.input.emit('data',Buffer.from('\x1b[D'));
    assert.equal(s.game.active.x,3);
    io.input.emit('data',Buffer.from('p'));assert.equal(clock.timers.size,0);
    io.input.emit('data',Buffer.from('p'));assert.equal(clock.timers.size,1);
    // Alt+r must also be inert when direct r would actually restart.
    for(let i=0;i<250 && !s.game.over;i++)io.input.emit('data',Buffer.from('\x1b[B'));
    assert(s.game.over);
    const over=JSON.stringify(s.game);
    for(const chunk of chunks)io.input.emit('data',Buffer.from(chunk));
    assert.equal(JSON.stringify(s.game),over);
    assert.equal(clock.timers.size,0);
    io.input.emit('data',Buffer.from('r'));assert(!s.game.over);
    assert.equal(clock.timers.size,1);
    io.input.emit('data',Buffer.from('q'));assert(!io.input.isRaw);
    assert.equal(clock.timers.size,0);
  }
});
test('R10 R11 R12: fake time, input, pause/resume, gameover, restart, resize and cleanup',()=>{
  const io=terminal(),clock=new Clock(),frames=[];
  const s=startSession({...io,clock,next:sequence(['O']),onFrame:f=>frames.push(f)});
  assert(io.input.isRaw);assert.equal(clock.timers.size,1);clock.advance(999);assert.equal(s.game.active.y,0);clock.advance(1);assert.equal(s.game.active.y,1);
  io.input.emit('data',Buffer.from('\x1b[D\x1b[A\x1b[B'));assert.equal(s.game.active.x,3);assert.equal(s.game.active.y,2);
  io.input.emit('data',Buffer.from('p'));const before=JSON.stringify(s.game);clock.advance(5000);io.input.emit('data',Buffer.from('\x1b[B'));assert.equal(JSON.stringify(s.game),before);assert.equal(clock.timers.size,0);
  io.input.emit('data',Buffer.from('p'));clock.advance(999);assert.equal(s.game.active.y,2);clock.advance(1);assert.equal(s.game.active.y,3);assert.equal(clock.timers.size,1);
  while(step(s.game));clock.advance(1000);assert.equal(s.game.active.y,0);
  // Reach game over by legal repeated soft drops, never board edits.
  for(let i=0;i<250 && !s.game.over;i++)io.input.emit('data',Buffer.from('\x1b[B'));
  assert(s.game.over);assert.equal(clock.timers.size,0);clock.advance(5000);io.input.emit('data',Buffer.from('r'));assert(!s.game.over);assert.equal(s.game.active.y,0);assert.equal(clock.timers.size,1);
  io.output.columns=10;io.output.rows=1;io.output.emit('resize');assert(strip(frames.at(-1)).length<10);assert.equal(frames.at(-1).split('\n').length,1);
  io.output.columns=52;io.output.rows=24;io.output.emit('resize');assert.equal(frames.at(-1).split('\n').length,24);
  assert(frames.every(f=>strip(f).split('\n').length<=24));assert(io.output.writes.filter(w=>w.startsWith('\x1b[H\x1b[2J')).length>2);
  io.input.emit('data',Buffer.from('q'));s.cleanup();assert(!io.input.isRaw);assert.equal(clock.timers.size,0);assert.equal(io.input.listenerCount('data'),0);assert.equal(io.output.listenerCount('resize'),0);assert.equal(io.signals.listenerCount('SIGTERM'),0);assert(io.output.writes.at(-1).includes('\x1b[?25h'));
});
test('R12 interruption, handled write failure, non-TTY and tiny dimensions',()=>{
  for(const mode of ['SIGINT','SIGTERM','SIGHUP','failure','nonTTY']){
    const io=terminal(),clock=new Clock();let errors=0;if(mode==='nonTTY')io.input.isTTY=false;
    const s=startSession({...io,clock,onError:()=>errors++});
    if(mode==='failure'){io.output.write=()=>{throw Error('write');};s.dispatch('left');assert.equal(errors,1);}
    else if(mode!=='nonTTY')io.signals.emit(mode);
    assert(!io.input.isRaw);assert.equal(clock.timers.size,0);assert.equal(io.input.listenerCount('data'),0);
    s.cleanup();
  }
  for(const [columns,rows] of [[1,1],[0,0],[30,12]]){const io=terminal();Object.assign(io.output,{columns,rows});let f;const s=startSession({...io,clock:new Clock(),onFrame:v=>f=v});assert(f.split('\n').length<=Math.max(1,rows));assert(strip(f).length<=Math.max(0,columns-1));s.cleanup();}
});
