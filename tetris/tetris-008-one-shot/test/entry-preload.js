// Controlled terminal/time only. Production main, model, decoder and renderer run unchanged.
import {Clock} from './helpers.js';
const clock=new Clock();
globalThis.setInterval=clock.setInterval.bind(clock);
globalThis.clearInterval=clock.clearInterval.bind(clock);
Object.defineProperty(process.stdin,'isTTY',{value:true});
Object.defineProperty(process.stdout,'isTTY',{value:true});
Object.defineProperty(process.stdout,'columns',{value:52});
Object.defineProperty(process.stdout,'rows',{value:24});
let raw=false;
process.stdin.setRawMode=v=>{raw=v;};process.stdin.resume=()=>{};process.stdin.pause=()=>{};
process.stdout.write=text=>{process.send({type:'write',text});return true;};
process.on('message',message=>{
  if(message.keys!==undefined)process.stdin.emit('data',Buffer.from(message.keys));
  if(message.tick)clock.advance(message.tick);
  process.send({type:'ack',raw,timers:clock.timers.size,listeners:process.stdin.listenerCount('data')});
});
process.on('disconnect',()=>process.exit(0));
setImmediate(()=>process.send({type:'ready'}));
