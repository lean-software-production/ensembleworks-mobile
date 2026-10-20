import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fork,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {strip} from '../src/render.js';
test('R01 R12 actual npm start non-TTY exits with one bounded plain frame',()=>{
  const result=spawnSync('npm',['start','--silent'],{encoding:'utf8',timeout:5000});assert.equal(result.status,0);assert.equal(result.stdout.split('\n').length,24);assert(!result.stdout.includes('\x1b'));assert(result.stdout.includes('Score: 0'));
});
test('R13 actual entry: legal fall -> lock -> double clear/300 -> gameover -> restart -> quit',async t=>{
  const child=fork('src/main.js',[],{execArgv:['--import','./test/entry-preload.js'],env:{...process.env,TETRIS_PIECES:'O'},stdio:['pipe','pipe','pipe','ipc']});
  t.after(()=>{if(child.connected)child.disconnect();child.kill();});
  const frames=[];let readyResolve,ackResolve;const ready=new Promise(r=>readyResolve=r);
  child.on('message',m=>{if(m.type==='write' && m.text.startsWith('\x1b[H\x1b[2J'))frames.push(strip(m.text));if(m.type==='ready')readyResolve();if(m.type==='ack')ackResolve(m);});
  const send=message=>new Promise(resolve=>{ackResolve=resolve;child.send(message);});
  await ready;
  assert.equal(frames.length,1);
  const first=frames.at(-1);await send({tick:999});assert.equal(frames.at(-1),first);await send({tick:1});assert.notEqual(frames.at(-1),first);
  // Five O pieces at x=0,2,4,6,8 fill the bottom two rows. Exactly
  // 19 down attempts lock a fresh O; the first has already fallen once.
  for(const [i,offset] of [-4,-2,0,2,4].entries()){
    await send({keys:(offset<0?'\x1b[D':'\x1b[C').repeat(Math.abs(offset))});
    await send({keys:'\x1b[B'.repeat(i===0?18:19)});
    if(i<4)assert(frames.at(-1).includes('Score: 0'));
  }
  assert(frames.at(-1).includes('Score: 300'));assert(!frames.at(-1).includes('GAME OVER'));
  // Ten more centered squares stack legally to the ceiling and obstruct spawn.
  let ack;
  for(let i=0;i<10;i++)ack=await send({keys:'\x1b[B'.repeat(19-i*2)});
  assert(frames.at(-1).includes('GAME OVER'));assert.equal(ack.timers,0);
  const over=frames.at(-1);await send({keys:'\x1b[D\x1b[A\x1b[B'});assert.equal(frames.at(-1),over);
  ack=await send({keys:'r'});assert(frames.at(-1).includes('Score: 0'));assert(!frames.at(-1).includes('GAME OVER'));assert.equal(ack.timers,1);
  await send({keys:'p'});assert(frames.at(-1).includes('PAUSED'));await send({keys:'p'});
  ack=await send({keys:'q'});assert.equal(ack.raw,false);assert.equal(ack.timers,0);assert.equal(ack.listeners,0);
  assert(frames.length>150);for(const frame of frames){const lines=frame.split('\n');assert.equal(lines.length,24);assert(lines.every(l=>l.length<52));}
  const exit=once(child,'exit');child.disconnect();await exit;
});
