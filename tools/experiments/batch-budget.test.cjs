const {test}=require('node:test'),assert=require('node:assert/strict');
const {select,factors,measure}=require('./batch-budget.cjs');
const config={version:1,limits:{implementation_minutes:30,validation_minutes:15,input_output_tokens:180000,context_tokens:80000},context_reserve:.25};
function tasks(n){return Array.from({length:n},(_,i)=>({id:'T'+i,estimate:{implementation_minutes:1,validation_minutes:.5,input_output_tokens:5000,context_tokens:2000}}));}
function batch(ts){return{split_after:ts.slice(0,-1).map(t=>t.id)};}
test('small plan selects whole reviewed group, exceeding old four-task cap',()=>{const ts=tasks(8);assert.equal(select(ts.map(t=>t.id),batch(ts),ts,config).task_ids.length,8);});
test('very large plan selects bounded prefix without depending on total task count',()=>{const ts=tasks(10000),s=select(ts.map(t=>t.id),batch(ts),ts,config);assert.equal(s.task_ids.length,30);assert.equal(s.predicted.context_tokens,60000);});
test('never invents split points and refuses oversized atomic work',()=>{const ts=tasks(40);assert.throws(()=>select(ts.map(t=>t.id),{split_after:[]},ts,config),/No reviewed prefix/);const s=select(ts.map(t=>t.id),{split_after:['T7','T19']},ts,config);assert.equal(s.task_ids.length,20);});
test('complete costly feedback shrinks later groups; comfortable feedback can expand within limits',()=>{
 const ts=tasks(40),ids=ts.map(t=>t.id),b=batch(ts),estimated={implementation_minutes:10,validation_minutes:5,input_output_tokens:50000};
 const measured={implementation_minutes:20,validation_minutes:10,input_output_tokens:100000,complete:{implementation_minutes:true,validation_minutes:true,input_output_tokens:true}};
 assert.equal(select(ids,b,ts,config,[{estimated,measured}]).task_ids.length,15);
 const cheap={...measured,implementation_minutes:5,validation_minutes:2.5,input_output_tokens:25000};const expanded=select(ids,b,ts,{...config,limits:{...config.limits,context_tokens:200000}},[{estimated,measured:cheap}]);assert.equal(expanded.task_ids.length,40);
});
test('missing usage cannot calibrate; cumulative cache reads do not pretend to measure context',()=>{
 const start='2026-10-18T10:00:00.000Z';const es=[{type:'machine',machine:'doer',status:'running',time:start},{type:'machine',machine:'doer',status:'finished',time:'2026-10-18T10:01:00.000Z'},{type:'machine',machine:'validator',status:'running',time:'2026-10-18T10:01:00.000Z'},{type:'usage',machine:'validator',inputTokens:10,outputTokens:5,cachedReadTokens:1000000,time:'2026-10-18T10:02:00.000Z'},{type:'machine',machine:'validator',status:'finished',time:'2026-10-18T10:02:00.000Z'}];
 const m=measure(es,start);assert.equal(m.input_output_tokens,15);assert.equal(m.complete.input_output_tokens,false);assert.equal(m.context_tokens,null);const f=factors([{estimated:{input_output_tokens:1},measured:m}]);assert.equal(f.input_output_tokens,1);assert.equal(f.context_tokens,1);
});
