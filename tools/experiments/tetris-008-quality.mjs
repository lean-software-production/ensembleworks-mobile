#!/usr/bin/env node
// Post-run, interface-adapted probes. Never edits the measured products.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const MODES=['ralph','one-shot','implement-in-batches'];
const target=mode=>path.join(ROOT,'tetris','tetris-008-'+mode);
async function adapter(mode){
 const module=async file=>import(pathToFileURL(path.join(target(mode),'src',file+'.js')));
 const model=await module('model'),session=await module('session');
 const input=mode==='implement-in-batches'?session:await module('input');
 const entry=mode==='ralph'?await module('main'):session;
 return {decode:input.createInputDecoder??input.decoder,
  create:type=>(model.createGame??model.createState)(()=>type),
  move:model.moveHorizontal??model.move,rotate:model.rotateClockwise??model.rotate,
  step:model.moveDown??model.step??(g=>model.stepDown(g).moved),
  clear:board=>{const value=model.clearLines(board);return typeof value==='number'?{count:value,board}:value;},
  render:(await module('render')).renderFrame??(await module('render')).render,
  start:options=>mode==='ralph'?entry.start({...options,game:model.createGame(options.next??(()=> 'O'))}):entry.startSession({next:()=> 'O',...options}),
  state:app=>app.game??app.state,
  stop:app=>(app.quit??app.cleanup)(),
  cells:model.activeCells??model.cells??model.cellsOf};
}
function clock(){let id=0;const timers=new Map(),history=[];return{timers,history,
 setTimeout(fn,ms){const key=++id;timers.set(key,{fn,ms,interval:false});history.push(fn);return key;},clearTimeout(key){timers.delete(key);},
 setInterval(fn,ms){const key=++id;timers.set(key,{fn,ms,interval:true});history.push(fn);return key;},clearInterval(key){timers.delete(key);},
 tick(){const pair=timers.entries().next().value;if(!pair)return;const [key,t]=pair;if(!t.interval)timers.delete(key);t.fn();}};}
function rig({oldRaw=false,tty=true,output}={}){
 const input=Object.assign(new EventEmitter(),{isTTY:tty,isRaw:oldRaw,readableFlowing:true,
 setRawMode(v){this.isRaw=v;},resume(){this.readableFlowing=true;},pause(){this.readableFlowing=false;}});
 const writes=[],signals=new EventEmitter(),scheduler=clock();
 output??=Object.assign(new EventEmitter(),{write(text){writes.push(text);return true;}});
 Object.assign(output,{isTTY:tty,columns:80,rows:24});
 return{input,output,signals,clock:scheduler,writes,onError(){}};
}
function control(matrix,inputs,expected){
 for(const input of inputs)for(let split=0;split<=input.length;split++){
  const actions=[],feed=matrix.decode(a=>actions.push(a==='toggle-pause'?'pause':a));
  feed(Buffer.from(input.slice(0,split)));feed(Buffer.from(input.slice(split)));
  assert.deepEqual(actions,expected,`sequence=${JSON.stringify(input)} split=${split} actions=${JSON.stringify(actions)}`);
 }
}
const strip=s=>s.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'');
const probes=[
 ['model_movement_rotation_and_render','baseline',a=>{for(const type of ['I','O','T','S','Z','J','L']){
  const game=a.create(type),before=JSON.stringify(game);for(let turn=0;turn<4;turn++)assert(a.rotate(game));assert.equal(JSON.stringify(game),before);
  const frame=a.render(game,{color:true});assert.equal(strip(frame).split('\n').length,24);assert.equal(JSON.stringify(game),before);
  for(const direction of [-1,1]){let moves=0;while(a.move(game,direction))assert(++moves<15);const wall=JSON.stringify(game);assert.equal(a.move(game,direction),false);assert.equal(JSON.stringify(game),wall);}
  let falls=0;while(a.step(game))assert(++falls<22);const floor=JSON.stringify(game);assert.equal(a.step(game),false);assert.equal(JSON.stringify(game),floor);assert(game.board.flat().every(c=>c===null));
 }return{piece_types:7};}],
 ['stable_multirow_clearing','baseline',a=>{for(let count=0;count<=4;count++){
  const board=Array.from({length:20},()=>Array(10).fill(null));board[3][0]='J';board[8][1]='L';for(let i=0;i<count;i++)board[19-2*i].fill('I');const surviving=board.filter(row=>row.some(c=>c===null)).map(row=>[...row]);
  const result=a.clear(board);assert.equal(result.count,count);assert.equal(result.board.length,20);assert.equal(new Set(result.board).size,20);assert(result.board.every(row=>row.length===10));assert.deepEqual(result.board.slice(count),surviving);assert(result.board.slice(0,count).flat().every(c=>c===null));
 }return{clear_counts:[0,1,2,3,4]};}],
 ['normal_keys','baseline',a=>control(a,['\x1b[D\x1b[C\x1b[A\x1b[Bprq'],['left','right','rotate','down','pause','restart','quit'])],
 ['unknown_csi','input',a=>control(a,['\x1b[?1p','\x1b[1:2q','\x1b[1 q','\x1b[>2r'],[])],
 ['unknown_control_strings','input',a=>control(a,['\x1b]0;q\x07','\x1bPq\x1b\\'],[])],
 ['unknown_escape_intermediates','input',a=>control(a,['\x1b(q','\x1b#p'],[])],
 ['ctrl_c_pending_escape','input',a=>control(a,['\x1b\x03','\x1b[\x03','\x1b[?1\x03','\x1b]0;\x03'],['quit'])],
 ['normal_quit_cleanup','baseline',a=>{const r=rig(),app=a.start(r);r.input.emit('data',Buffer.from('q'));assert.equal(r.input.isRaw,false);assert.equal(r.clock.timers.size,0);assert.equal(r.input.listenerCount('data'),0);a.stop(app);}],
 ['preserve_existing_raw_mode','terminal',a=>{const r=rig({oldRaw:true}),app=a.start(r);a.stop(app);assert.equal(r.input.isRaw,true,'pre-existing raw mode must be restored');}],
 ['input_eof_cleanup','terminal',a=>{const r=rig(),app=a.start(r);try{r.input.emit('end');assert.equal(r.clock.timers.size,0,'EOF left a gravity timer running');assert.equal(r.input.isRaw,false);assert.equal(r.input.listenerCount('data'),0);}finally{a.stop(app);}}],
 ['preserve_unrelated_listeners','terminal',a=>{const r=rig(),external=()=>{};r.input.on('error',external);r.output.on('error',external);r.signals.on('SIGTERM',external);const app=a.start(r);a.stop(app);assert.deepEqual(r.input.listeners('error'),[external]);assert.deepEqual(r.output.listeners('error'),[external]);assert.deepEqual(r.signals.listeners('SIGTERM'),[external]);}],
 ['stale_gravity_after_quit','injected_scheduler',a=>{const r=rig(),app=a.start(r),callback=r.clock.history[0];a.stop(app);const before=JSON.stringify(a.state(app)),writes=r.writes.length;callback();assert.equal(JSON.stringify(a.state(app)),before,'a canceled callback mutated the game after quit');assert.equal(r.writes.length,writes,'a canceled callback redrew after quit');}],
 ['bounded_non_tty','baseline',a=>{const r=rig({tty:false}),app=a.start(r);assert.equal(r.clock.timers.size,0);assert.equal(r.input.listenerCount('data'),0);const output=r.writes.join('');assert(!output.includes('\x1b'));assert.equal(output.split('\n').length,24);a.stop(app);}],
 ['legal_gameplay_invariants','baseline',a=>{let piece=0;const seen=new Set(),types=['I','O','T','S','Z','J','L'];const r=rig(),app=a.start({...r,next:()=>types[piece++%types.length]});let seed=73,restarts=0;const keys=['\x1b[D','\x1b[C','\x1b[A','\x1b[B','\x1b[B','\x1b[B','p'];try{for(let i=0;i<1500;i++){
  const state=a.state(app),over=state.over??state.status==='game-over';
  if(over){r.input.emit('data',Buffer.from('r'));restarts++;}else{seed=(Math.imul(seed,1664525)+1013904223)>>>0;r.input.emit('data',Buffer.from(keys[seed%keys.length]));}
  if(i%3===0)r.clock.tick();
  const g=a.state(app);assert.equal(g.board.length,20);assert(g.board.every(row=>row.length===10));assert.equal(new Set(g.board).size,20);assert(g.score>=0&&Number.isFinite(g.score));
  if(g.active){seen.add(g.active.type);const cells=a.cells(g.active);assert.equal(new Set(cells.map(String)).size,4);for(const [x,y]of cells){assert(Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<10&&y>=0&&y<20);assert.equal(g.board[y][x],null);}}
  assert(r.clock.timers.size<=1);if(g.paused||g.over||g.status==='paused'||g.status==='game-over')assert.equal(r.clock.timers.size,0);
 }
 for(const text of r.writes){const visible=strip(text);assert(visible.split('\n').length<=24);assert(visible.split('\n').every(row=>row.length<=80));}
 assert.equal(seen.size,7);return{actions:1500,restarts,piece_types_observed:[...seen]};}finally{a.stop(app);}}],
 ['import_entry_without_output','importability',(_a,mode)=>{const code=`await import(${JSON.stringify(pathToFileURL(path.join(target(mode),'src/main.js')).href)})`;const r=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',timeout:3000});assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.length,0,`import produced ${r.stdout.length} bytes of terminal output`);}],
 ['delayed_writable_error_after_quit','real_writable',(_a,mode)=>{const result=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--late-write',mode],{encoding:'utf8',timeout:3000});assert.equal(result.status,0,result.stderr.slice(0,1100));}]
];
if(process.argv[2]==='--late-write'){
 const a=await adapter(process.argv[3]);
 const output=new Writable({write(_data,_encoding,callback){setTimeout(()=>callback(new Error('post-quit asynchronous output failure')),20);}});
 const r=rig({output}),app=a.start(r);a.stop(app);await new Promise(resolve=>setTimeout(resolve,80));
}else{
 const observations=[];
 for(const mode of MODES){const a=await adapter(mode),checks=[];
  for(const [id,category,probe]of probes){try{const detail=probe(a,mode);checks.push({id,category,passed:true,...detail});}catch(error){checks.push({id,category,passed:false,evidence:error.message.slice(0,1400)});}}
  observations.push({mode,checks});
 }
 console.log(JSON.stringify({scope:'Post-run shared probes; products unchanged. Injected scheduler, raw-mode and EOF probes are adapter robustness checks; real Writable errors use actual Node streams. Do not turn counts into an overall quality score.',observations},null,2));
}
