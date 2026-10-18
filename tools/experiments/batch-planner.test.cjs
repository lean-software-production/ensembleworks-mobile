const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const {readContract,run}=require('./batch-planner.cjs');
function contract(){return {version:1,tasks:Array.from({length:13},(_,i)=>({id:`T${String(i+1).padStart(2,'0')}`,title:`Work ${i+1}`,requirements:[`R${String(i+1).padStart(2,'0')}`],acceptance:['Observable check']})),batches:[{id:'B01',title:'Deliver coherent product',task_ids:Array.from({length:13},(_,i)=>`T${String(i+1).padStart(2,'0')}`),depends_on:[],reason:'Reviewed group',split_after:['T04','T08']}]};}
function text(c){return '# Plan\n```batch-plan\n'+JSON.stringify(c)+'\n```\n';}
function fixture(t,mode='e05'){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'batch-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const target=path.join(dir,'tetris-'+mode);fs.mkdirSync(target);const plan=path.join(dir,'plan.md');fs.writeFileSync(plan,text(contract()));fs.writeFileSync(path.join(dir,'plan-review.json'),JSON.stringify({status:'accepted',decision:{satisfied:true}}));const git=(...args)=>cp.execFileSync('git',['-C',target,...args],{encoding:'utf8'}).trim();git('init','-q');return {dir,target,plan,git};
}
test('validates coverage, unique membership, dependencies and reviewed split points',()=>{
 assert.equal(readContract(text(contract())).tasks.length,13);
 for(const mutate of [c=>c.tasks[0].requirements=['R99'],c=>c.batches[0].task_ids.push('T01'),c=>c.batches[0].depends_on=['B02'],c=>c.batches[0].split_after=['T13'],c=>c.batches[0].task_ids.pop()]){const c=contract();mutate(c);assert.throws(()=>readContract(text(c)));}
 assert.throws(()=>readContract(text(contract())+text(contract())),/Exactly one/);
});
test('selects only reviewed bounded prefixes and keeps active selection fixed on resume',t=>{
 const f=fixture(t),ctx={plan:f.plan,target:f.target,committed:''};const a=run(ctx);assert.deepEqual(a.batch.task_ids,['T01','T02','T03','T04']);assert.equal(run(ctx).batch.work_item,a.batch.work_item);
 const c=contract();c.batches[0].title='Unreviewed change';fs.writeFileSync(f.plan,text(c));assert.throws(()=>run(ctx),/contract changed/);
});
test('authoritative receipt completes exact batch despite historical pending notes',t=>{
 const f=fixture(t),ctx={plan:f.plan,target:f.target,committed:''},selected=run(ctx).batch;fs.writeFileSync(path.join(f.target,'product.txt'),'verified');f.git('add','product.txt');f.git('-c','user.name=Test','-c','user.email=test@example.test','commit','-q','-m',selected.work_item);const hash=f.git('rev-parse','HEAD');ctx.committed=JSON.stringify({task:selected.work_item,task_ids:selected.task_ids,limitations:'Validator review and commit remain pending.'});ctx.commit_receipt=JSON.stringify({status:'committed',task:selected.work_item,commit:hash,validation:{satisfied:true}});const next=run(ctx);assert.deepEqual(next.batch.task_ids,['T05','T06','T07','T08']);assert.throws(()=>run(ctx),/receipt does not match/);
});
test('rejects absent validation or wrong Git hash without changing completion',t=>{
 const f=fixture(t),ctx={plan:f.plan,target:f.target,committed:''},a=run(ctx).batch;ctx.committed=JSON.stringify({task:a.work_item,task_ids:a.task_ids});ctx.commit_receipt=JSON.stringify({status:'committed',task:a.work_item,commit:'fake',validation:{satisfied:false}});assert.throws(()=>run(ctx),/receipt does not match/);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.dir,'batch-state.json'))).done,[]);
});
test('whole-plan comparator never splits and finishes after one validated commit',t=>{
 const f=fixture(t,'e06');let c=contract();c.batches[0].split_after=[];fs.writeFileSync(f.plan,text(c));const ctx={plan:f.plan,target:f.target,committed:''},a=run(ctx).batch;assert.equal(a.task_ids.length,13);fs.writeFileSync(path.join(f.target,'game.txt'),'complete');f.git('add','game.txt');f.git('-c','user.name=Test','-c','user.email=test@example.test','commit','-q','-m',a.work_item);ctx.committed=JSON.stringify({task:a.work_item,task_ids:a.task_ids});ctx.commit_receipt=JSON.stringify({status:'committed',task:a.work_item,commit:f.git('rev-parse','HEAD'),validation:{satisfied:true}});assert.deepEqual(run(ctx),{complete:true});
});
test('ACP session returns selected batch with known zero usage',async t=>{
 const f=fixture(t);const child=cp.spawn(process.execPath,[path.join(__dirname,'batch-planner.cjs')],{stdio:['pipe','pipe','pipe']});t.after(()=>child.kill());let buffer='';const pending=new Map();child.stdout.on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\n'))>=0){const m=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);if(m.id!==undefined){const resolve=pending.get(m.id);if(resolve){pending.delete(m.id);resolve(m);}}}});
 function request(id,method,params){return new Promise(resolve=>{pending.set(id,resolve);child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});}
 assert.equal((await request(1,'initialize',{})).result.protocolVersion,1);assert.equal((await request(2,'session/new',{})).result.sessionId,'batch-planner');const p='Instructions\nRun context:\n'+JSON.stringify({target:f.target,plan:f.plan,committed:''})+'\nFinish with a result';const response=await request(3,'session/prompt',{prompt:[{type:'text',text:p}]});assert.equal(response.error,undefined);assert.equal(response.result.usage.inputTokens,0);assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir,'batch-state.json'))).active.task_ids.length,4);child.stdin.end();
});
test('budget selection persists its scope and refuses configuration drift',t=>{
 const f=fixture(t,'e07'),c=contract();for(const task of c.tasks)task.estimate={implementation_minutes:1,validation_minutes:.5,input_output_tokens:1000,context_tokens:1000};fs.writeFileSync(f.plan,text(c));fs.mkdirSync(path.join(f.target,'.assembly-lines'));
 const config={version:1,limits:{implementation_minutes:10,validation_minutes:10,input_output_tokens:100000,context_tokens:100000},context_reserve:.25};const file=path.join(f.target,'.assembly-lines/batch-budget.json');fs.writeFileSync(file,JSON.stringify(config));const ctx={plan:f.plan,target:f.target,committed:''};const a=run(ctx);assert.equal(a.batch.task_ids.length,8);assert.equal(run(ctx).batch.task_ids.length,8);assert.equal(a.batch.budget.limits.implementation_minutes,10);
 config.limits.implementation_minutes=5;fs.writeFileSync(file,JSON.stringify(config));assert.throws(()=>run(ctx),/Budget changed/);
});
