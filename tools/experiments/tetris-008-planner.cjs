#!/usr/bin/env node
// E008 uses one frozen task catalogue; only the reviewed execution grouping varies.
const fs=require('node:fs'),path=require('node:path');
const base=require('./batch-planner.cjs');
function validate(contract,policy){
 if(!require('node:util').isDeepStrictEqual(contract.tasks,policy.tasks))throw Error('Frozen execution tasks changed');
 const groups=contract.batches.map(b=>b.task_ids);
 if(JSON.stringify(groups.flat())!==JSON.stringify(policy.tasks.map(t=>t.id)))throw Error('Execution order must preserve frozen task order');
 if(contract.batches.some(b=>b.split_after.length))throw Error('E008 executes reviewed groups without automatic splitting');
 if(policy.mode==='ralph'&&groups.some(g=>g.length!==1))throw Error('Ralph requires singleton batches');
 if(policy.mode==='one-shot'&&groups.length!==1)throw Error('One-shot requires exactly one full-plan batch');
 if(policy.mode==='implement-in-batches'&&(groups.length<2||groups.length>=policy.tasks.length))throw Error('Logical batches require between 2 and 12 reviewed groups');
}
function run(c){
 const policy=JSON.parse(fs.readFileSync(path.join(c.target,'.assembly-lines/experiment.json'),'utf8'));
 validate(base.readContract(fs.readFileSync(c.plan,'utf8')),policy);
 return base.run(c);
}
function serve(){const send=x=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',...x})+'\n');require('node:readline').createInterface({input:process.stdin}).on('line',line=>{let m;try{m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{protocolVersion:1,agentCapabilities:{},authMethods:[]}});else if(m.method==='session/new')send({id:m.id,result:{sessionId:'tetris-008'}});else if(m.method==='session/prompt'){const result=run(base.context(m.params.prompt.map(x=>x.text||'').join('\n')));send({method:'session/update',params:{sessionId:'tetris-008',update:{sessionUpdate:'agent_message_chunk',content:{type:'text',text:JSON.stringify(result)+'\n'}}}});send({id:m.id,result:{stopReason:'end_turn',usage:{inputTokens:0,outputTokens:0,cachedReadTokens:0,cachedWriteTokens:0}}});}else if(m.id!==undefined)send({id:m.id,error:{code:-32601,message:'Unsupported method'}});}catch(e){send({id:m?.id??null,error:{code:-32602,message:e.message}});}});}
if(require.main===module)serve();module.exports={validate,run};
