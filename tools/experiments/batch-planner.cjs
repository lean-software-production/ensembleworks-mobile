#!/usr/bin/env node
// An ordinary ACP machine. Batch decisions are authored/reviewed in the plan.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const EXPECTED=Array.from({length:13},(_,i)=>`R${String(i+1).padStart(2,'0')}`);
function assert(ok,message){if(!ok)throw Error(message);}
function readContract(text){
 const blocks=[...text.matchAll(/```batch-plan\s*\n([\s\S]*?)\n```/g)];assert(blocks.length===1,'Exactly one batch-plan JSON block is required.');
 const c=JSON.parse(blocks[0][1]);assert(c.version===1&&Array.isArray(c.tasks)&&c.tasks.length&&Array.isArray(c.batches)&&c.batches.length,'Invalid batch plan.');
 const ids=new Set(),requirements=new Set();
 for(const t of c.tasks){assert(/^T\d+$/.test(t.id)&&!ids.has(t.id)&&typeof t.title==='string'&&t.title.trim(),'Unique task IDs/titles required.');ids.add(t.id);assert(Array.isArray(t.requirements)&&t.requirements.length,'Task requirement mapping missing.');for(const r of t.requirements){assert(EXPECTED.includes(r),'Unknown requirement');requirements.add(r);}assert(Array.isArray(t.acceptance)&&t.acceptance.length&&t.acceptance.every(x=>typeof x==='string'&&x.trim()),'Task acceptance missing.');}
 assert(EXPECTED.every(r=>requirements.has(r)),'All 13 original requirements must be covered.');
 const seen=new Set(),bids=new Set();
 for(const b of c.batches){assert(/^B\d+$/.test(b.id)&&!bids.has(b.id)&&typeof b.title==='string'&&b.title.trim(),'Unique batch IDs/titles required.');assert(typeof b.reason==='string'&&b.reason.trim(),'Batch rationale missing.');assert(Array.isArray(b.depends_on)&&b.depends_on.every(d=>bids.has(d)),'Dependencies must reference earlier batches.');assert(Array.isArray(b.task_ids)&&b.task_ids.length,'Empty batch');for(const id of b.task_ids){assert(ids.has(id)&&!seen.has(id),'Every task must occur in exactly one batch.');seen.add(id);}assert(Array.isArray(b.split_after)&&b.split_after.every(id=>b.task_ids.slice(0,-1).includes(id))&&new Set(b.split_after).size===b.split_after.length,'Invalid reviewed split point.');bids.add(b.id);}
 assert(seen.size===ids.size,'Unbatched tasks');return c;
}
function atomic(file,value){const temp=file+'.'+crypto.randomUUID()+'.tmp';try{fs.writeFileSync(temp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}}
function context(prompt){const marker='\nRun context:\n';const start=prompt.lastIndexOf(marker);assert(start>=0,'Missing Run context');return JSON.parse(prompt.slice(start+marker.length).split('\n')[0]);}
function git(target,...args){return cp.execFileSync('git',['-C',target,...args],{encoding:'utf8'}).trim();}
function run(c){
 assert(path.isAbsolute(c.plan)&&path.isAbsolute(c.target),'Absolute paths required');const dir=path.dirname(c.plan);const review=JSON.parse(fs.readFileSync(path.join(dir,'plan-review.json'),'utf8'));assert(review.status==='accepted'&&review.decision?.satisfied===true,'Plan must be independently accepted.');
 const contract=readContract(fs.readFileSync(c.plan,'utf8')),hash=crypto.createHash('sha256').update(JSON.stringify(contract)).digest('hex');const file=path.join(dir,'batch-state.json');
 let s=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{version:1,contract_hash:hash,done:[],active:null,commits:[]};
 assert(s.contract_hash===hash,'Reviewed batch contract changed during execution; preserve state and request explicit repair.');
 const committed=c.committed?JSON.parse(c.committed):null;
 if(committed){
  const receipt=JSON.parse(c.commit_receipt||'{}');assert(s.active,'No selected batch for committed work');assert(committed.task===s.active.work_item&&receipt.task===s.active.work_item&&receipt.status==='committed'&&receipt.validation?.satisfied===true,'Accepted commit receipt does not match selected batch');assert(git(c.target,'rev-parse','HEAD')===receipt.commit&&git(c.target,'log','-1','--format=%s')===s.active.work_item,'Git receipt mismatch');
  assert(JSON.stringify(committed.task_ids)===JSON.stringify(s.active.task_ids),'Doer result must identify exact selected task IDs');for(const id of s.active.task_ids){assert(!s.done.includes(id),'Duplicate task completion');s.done.push(id);}s.commits.push({task_ids:s.active.task_ids,commit:receipt.commit,work_item:s.active.work_item});s.active=null;
 }
 if(s.active){atomic(file,s);return{complete:false,batch:s.active};} // Retry/resume keeps selection fixed.
 const batch=contract.batches.find(b=>b.task_ids.some(id=>!s.done.includes(id)));
 if(!batch){atomic(file,s);return{complete:true};}
 for(const dependency of batch.depends_on){const b=contract.batches.find(x=>x.id===dependency);assert(b.task_ids.every(id=>s.done.includes(id)),'Unsatisfied batch dependency');}
 const remaining=batch.task_ids.filter(id=>!s.done.includes(id));let selected=remaining;
 // Optional ordinary-code split policy: one reviewed prefix at most 4 tasks;
 // hard boundaries remain intact where the plan offers no reviewed split point.
 const mode=path.basename(c.target).includes('e06')?'whole':'adaptive';
 if(mode==='whole')assert(contract.batches.length===1,'Whole-plan comparison requires exactly one batch.');
 if(mode==='adaptive'&&remaining.length>4){const candidates=remaining.slice(0,4).filter(id=>batch.split_after.includes(id));if(candidates.length)selected=remaining.slice(0,remaining.indexOf(candidates.at(-1))+1);}
 const work_item=`Batch ${batch.id}: ${selected.join(',')}`;
 s.active={id:batch.id,title:batch.title,work_item,task_ids:selected,requirements:[...new Set(selected.flatMap(id=>contract.tasks.find(t=>t.id===id).requirements))],acceptance:selected.map(id=>({task_id:id,checks:contract.tasks.find(t=>t.id===id).acceptance})),reason:batch.reason,contract_hash:hash};atomic(file,s);return{complete:false,batch:s.active};
}
function serve(){const send=x=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',...x})+'\n');require('node:readline').createInterface({input:process.stdin}).on('line',line=>{let m;try{m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{protocolVersion:1,agentCapabilities:{},authMethods:[]}});else if(m.method==='session/new')send({id:m.id,result:{sessionId:'batch-planner'}});else if(m.method==='session/prompt'){const result=run(context(m.params.prompt.map(x=>x.text||'').join('\n')));send({method:'session/update',params:{sessionId:'batch-planner',update:{sessionUpdate:'agent_message_chunk',content:{type:'text',text:JSON.stringify(result)+'\n'}}}});send({id:m.id,result:{stopReason:'end_turn',usage:{inputTokens:0,outputTokens:0,cachedReadTokens:0,cachedWriteTokens:0}}});}else if(m.id!==undefined)send({id:m.id,error:{code:-32601,message:'Unsupported method'}});}catch(e){send({id:m?.id??null,error:{code:-32602,message:e.message}});}});}
if(require.main===module)serve();module.exports={readContract,run,context};
