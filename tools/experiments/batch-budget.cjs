// Resource policy is independent of task/plan size; only reviewed prefixes qualify.
const FIELDS=['implementation_minutes','validation_minutes','input_output_tokens','context_tokens'];
function positive(x){return Number.isFinite(x)&&x>0;}
function validate(config,tasks){
 if(config.version!==1||!FIELDS.every(k=>positive(config.limits?.[k]))||!Number.isFinite(config.context_reserve)||config.context_reserve<0||config.context_reserve>=1)throw Error('Invalid resource budget configuration');
 for(const t of tasks)if(!FIELDS.every(k=>positive(t.estimate?.[k])))throw Error('Every execution task requires positive reviewed resource estimates: '+t.id);
}
function estimate(ids,tasks){const lookup=new Map(tasks.map(t=>[t.id,t]));const total=Object.fromEntries(FIELDS.map(k=>[k,0]));for(const id of ids){const t=lookup.get(id);if(!t)throw Error('Unknown task '+id);for(const k of FIELDS)total[k]+=t.estimate[k];}return total;}
function factors(history){const f=Object.fromEntries(FIELDS.map(k=>[k,1]));
 for(const k of FIELDS){if(k==='context_tokens')continue;const reliable=history.filter(h=>h.estimated?.[k]>0&&h.measured?.[k]>0&&h.measured.complete?.[k]===true).slice(-3);if(reliable.length){const sum=reliable.reduce((a,h)=>a+h.measured[k],0),expected=reliable.reduce((a,h)=>a+h.estimated[k],0);f[k]=Math.max(.5,Math.min(4,sum/expected));}}
 return f;
}
function select(remaining,batch,tasks,config,history=[]){
 validate(config,tasks);const scale=factors(history),limits={...config.limits,context_tokens:config.limits.context_tokens*(1-config.context_reserve)};
 const lookup=new Map(tasks.map(t=>[t.id,t])),splits=new Set(batch.split_after),prefix=[Object.fromEntries(FIELDS.map(k=>[k,0]))];
 for(const id of remaining){const task=lookup.get(id);if(!task)throw Error('Unknown task '+id);const prior=prefix.at(-1);prefix.push(Object.fromEntries(FIELDS.map(k=>[k,prior[k]+task.estimate[k]])));}
 for(let end=remaining.length;end>0;end--){if(end!==remaining.length&&!splits.has(remaining[end-1]))continue;const raw=prefix[end],predicted=Object.fromEntries(FIELDS.map(k=>[k,raw[k]*scale[k]]));if(FIELDS.every(k=>predicted[k]<=limits[k]))return{task_ids:remaining.slice(0,end),estimated:raw,predicted,limits,calibration:scale,decision:'Largest reviewed prefix fitting all resource estimates; task count is not a limit.'};}
 throw Error('No reviewed prefix fits resource budgets. Preserve work and request a smaller independently testable reviewed boundary; do not run an oversized atomic task.');
}
function measure(events,start){
 const calls=[],active=new Map();
 for(const e of events){if(!['doer','validator'].includes(e.machine)||!e.time||e.time<start)continue;
  if(e.type==='machine'&&e.status==='running'){const c={machine:e.machine,time:e.time,usage:false,finished:false};calls.push(c);active.set(e.machine,c);}
  else if(e.type==='usage'&&active.has(e.machine)){const c=active.get(e.machine);c.usage=Number.isFinite(e.inputTokens)&&Number.isFinite(e.outputTokens);c.tokens=e.inputTokens+e.outputTokens;}
  else if(e.type==='machine'&&active.has(e.machine)){const c=active.get(e.machine);c.finished=true;c.minutes=(Date.parse(e.time)-Date.parse(c.time))/60000;active.delete(e.machine);}
 }
 const times=kind=>calls.filter(c=>c.machine===kind),minutes=kind=>times(kind).reduce((a,c)=>a+(c.minutes||0),0);
 return{implementation_minutes:minutes('doer'),validation_minutes:minutes('validator'),input_output_tokens:calls.filter(c=>c.usage).reduce((a,c)=>a+c.tokens,0),context_tokens:null,complete:{implementation_minutes:times('doer').length>0&&times('doer').every(c=>c.finished),validation_minutes:times('validator').length>0&&times('validator').every(c=>c.finished),input_output_tokens:calls.length>0&&calls.every(c=>c.finished&&c.usage),context_tokens:false},calls:calls.length,note:'Context occupancy is not available in ACP totals; cache counters are not context occupancy. Missing measurements cannot calibrate estimates.'};
}
module.exports={FIELDS,validate,estimate,factors,select,measure};
