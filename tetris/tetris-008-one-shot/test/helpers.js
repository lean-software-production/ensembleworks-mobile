import {EventEmitter} from 'node:events';
export class Clock {
  now=0; next=1; timers=new Map();
  setInterval(fn,ms){const id=this.next++;this.timers.set(id,{fn,ms,at:this.now+ms});return id;}
  clearInterval(id){this.timers.delete(id);}
  advance(ms){const end=this.now+ms;while(true){const due=[...this.timers.entries()].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;this.now=due[1].at;due[1].at+=due[1].ms;due[1].fn();}this.now=end;}
}
export function terminal(){const input=new EventEmitter(),output=new EventEmitter(),signals=new EventEmitter();Object.assign(input,{isTTY:true,isRaw:false,setRawMode(v){this.isRaw=v;},resume(){},pause(){this.stopped=true;}});Object.assign(output,{isTTY:true,columns:52,rows:24,writes:[],write(s){this.writes.push(s);}});return {input,output,signals};}
