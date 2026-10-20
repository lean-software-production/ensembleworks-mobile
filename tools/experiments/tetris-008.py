#!/usr/bin/env python3
"""Sequential E008 study in the current checkout; no worktrees, no silent recovery."""
import argparse,fcntl,hashlib,html,importlib.util,json,os,re,shutil,subprocess,sys,time
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'docs/experiments/tetris-008'
MODES=['ralph','one-shot','implement-in-batches']
ATTEMPTS=5
LINES={'ralph':'implement-reviewed-ralph','one-shot':'implement-reviewed-one-shot','implement-in-batches':'implement-reviewed-batches'}
def now():return datetime.now(timezone.utc).isoformat()
def module(name,file):
 s=importlib.util.spec_from_file_location(name,Path(__file__).with_name(file));m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def write(p,v):
 p.parent.mkdir(parents=True,exist_ok=True);tmp=p.with_suffix(p.suffix+'.tmp');tmp.write_text(json.dumps(v,indent=2)+'\n');tmp.replace(p)
def events(run):
 p=run/'record.jsonl';return [json.loads(s) for s in p.read_text().split('\n')[:-1] if s.strip()] if p.exists() else []
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def env():return dict(os.environ,TS_NODE_TRANSPILE_ONLY='true',PATH=str(ROOT/'tools/pi-rpc-acp')+os.pathsep+os.environ['PATH'])
def paths(mode):
 name='tetris-008-'+mode;return name,ROOT/'tetris'/name,ROOT/'factory/runs'/name,BASE/'runs'/name
def frozen_tasks(text):
 sections=re.findall(r'^- \[ \] (\d+)\. (.+)\n([\s\S]*?)(?=^- \[ \] \d+\.|^## Completion rule)',text,re.M)
 assert len(sections)==13
 return [{'id':f'T{int(n):02d}','title':title.strip(),'requirements':[f'R{int(n):02d}'],'acceptance':[l.strip()[2:] for l in body.splitlines() if l.strip().startswith('- ')]} for n,title,body in sections]
def prepare():
 BASE.mkdir(parents=True,exist_ok=True)
 if (BASE/'dataset.json').exists():raise RuntimeError('E008 is already prepared; refusing to overwrite observations.')
 for mode in MODES:
  _,target,run,_=paths(mode)
  if target.exists() or run.exists():raise RuntimeError(f'Refusing to overwrite {target} or {run}')
 original=(ROOT/'docs/experiments/tetris-007/inputs/plan.md').read_text();tasks=frozen_tasks(original)
 seed=(ROOT/'docs/experiments/tetris-007/inputs/seed.md').read_text()+'\nPlain non-TTY output is permitted. All seven colours are verified interactively. Full production lifecycle fixtures must use legal input/ticks, without direct state edits to force game over.\n'
 catalogue=re.sub(r'(?m)^- \[ \] (\d+)\. (.+)$',lambda m:'### R'+m[1].zfill(2)+'. '+m[2],original)
 catalogue=catalogue.replace('Every task below must produce a focused committable change in the target, including the automated checks described. Tasks remain unchecked until their changes have been committed.','R01–R13 below are the fixed acceptance catalogue. Execute the frozen T01–T13 tasks in order; only reviewed batch grouping differs between configurations.')
 catalogue=catalogue.replace('The plan is complete only when every task and subtask above has been delivered and committed, with no unchecked task remaining. Verification alone does not complete missing implementation work.','Completion requires every frozen execution task accepted, committed and recorded in batch-state.json. Verification alone does not complete missing implementation work.')
 (BASE/'inputs/seed.md').write_text(seed);(BASE/'inputs/original-acceptance.md').write_text(original);write(BASE/'inputs/tasks.json',tasks)
 variant=module('reviewed','reviewed-batches.py');records=[]
 for mode in MODES:
  name,target,run,out=paths(mode);shutil.copytree(ROOT/'docs/experiments/tetris-007/inputs/assembly-lines',target/'.assembly-lines');variant.configure(target)
  assembly=target/'.assembly-lines';(assembly/'efficient.dot').rename(assembly/(LINES[mode]+'.dot'))
  if mode=='one-shot':groups=[tasks]
  elif mode=='ralph':groups=[[t] for t in tasks]
  else:groups=[tasks[:5],tasks[5:10],tasks[10:]]
  batches=[{'id':f'B{i+1:02d}','title':f'Execution group {i+1}','task_ids':[t['id'] for t in g],'depends_on':[] if i==0 else [f'B{i:02d}'],'reason':'Reviewed execution unit for the fixed task sequence.','split_after':[]} for i,g in enumerate(groups)]
  contract={'version':1,'tasks':tasks,'batches':batches}
  run.mkdir(parents=True);(run/'plan.md').write_text(catalogue+'\n## Execution plan\n\nThe author/planner clarifies contracts and reviews grouping before implementation. Frozen tasks must remain byte-equivalent as parsed JSON.\n\n```batch-plan\n'+json.dumps(contract,indent=2)+'\n```\n')
  policy={'mode':mode,'tasks':tasks};write(assembly/'experiment.json',policy)
  instructions=f'''\nE008 CONTROLLED STUDY — overrides task-decomposition/splitting advice above.
Mode: {mode}. The 13 task definitions in .assembly-lines/experiment.json are frozen.
Preserve tasks, IDs, title, requirement mapping, acceptance and order EXACTLY.
Do not introduce new required acceptance or change the task decomposition. Clarify
minimal collaboration contracts in prose without adding features or implementation mandates.
'''
  if mode=='ralph':instructions+='Keep exactly 13 singleton batches, T01 through T13 in order.\n'
  elif mode=='one-shot':instructions+='Keep exactly one batch containing T01 through T13 in order.\n'
  else:instructions+='The author/planner must propose cohesive logical batches before review. The starting three groups are placeholders, not prescribed boundaries. Choose between 2 and 12 groups, explain shared code/dependencies and independently testable boundaries. Preserve task order.\n'
  instructions+='All batches have split_after:[]; no four-task cap or automatic split. Dependencies refer to earlier batches. Three reviewers must assess the proposed grouping and task contracts. No runtime resource calibration. Keep terminal-session ownership coherent; intermediate tasks need only their scoped acceptance, final delivery checks all requirements.\n'
  for n in ['plan_author','plan_reviewer_opus','plan_reviewer_gemini','plan_reviewer_astra','plan_synthesiser']:
   p=assembly/'.machines'/n/'AGENTS.md';p.write_text(p.read_text()+instructions)
  for cfg in (assembly/'.machines').glob('*/machine.json'):
   d=json.loads(cfg.read_text())
   if d.get('model')=='openai-codex/gpt-6.1-sol':d['model']+=':medium'
   if cfg.parent.name=='planner':d={'role':'planner','harness':str(ROOT/'tools/experiments/tetris-008-planner.cjs')}
   write(cfg,d)
   if d.get('adapter')=='pi':
    source=ROOT/'tetris/tetris-007/.assembly-lines/.machines'/cfg.parent.name/'auth.json'
    if not source.exists():raise RuntimeError(f'Missing machine login: {cfg.parent.name}')
    shutil.copy2(source,cfg.parent/'auth.json');os.chmod(cfg.parent/'auth.json',0o600)
  out.mkdir(parents=True);shutil.copy2(run/'plan.md',out/'initial-plan.md');shutil.copytree(assembly,out/'assembly-line',ignore=shutil.ignore_patterns('auth.json','.credentials.json'))
  records.append({'id':name,'mode':mode,'line':LINES[mode],'status':'queued','target':str(target),'run':str(run),'initial_plan_hash':digest(run/'plan.md'),'config_hashes':{str(p.relative_to(assembly)):digest(p) for p in assembly.rglob('*') if p.is_file() and p.name not in ['auth.json','.credentials.json']}})
  subprocess.run([str(ROOT/'bin/factory'),'--check-line','--target',str(target),'--line',LINES[mode]],cwd=ROOT,env=env(),check=True)
 manifest={'version':1,'created':now(),'order':MODES,'attempt_limit':ATTEMPTS,'plan_round_limit':5,'trial_timeout_minutes':90,'lines':LINES,'checkout_commit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'runner_hashes':{str(p.relative_to(ROOT)):digest(p) for p in [Path(__file__).resolve(),Path(__file__).with_name('tetris-008-planner.cjs'),ROOT/'factory/src/engine.ts',ROOT/'factory/src/prompts.ts',ROOT/'factory/src/acp.ts'] if p.exists()},'shared_input_hashes':{p.name:digest(p) for p in (BASE/'inputs').iterdir()},'models':{p.parent.name:json.loads(p.read_text()).get('model','ordinary code') for p in (paths(MODES[0])[1]/'.assembly-lines/.machines').glob('*/machine.json')},'runs':records}
 write(BASE/'dataset.json',manifest);refresh();print('Prepared three targets in the current checkout. No model calls made.')
def metrics(es):
 calls=module('report008','report.py').calls(es);usage=[e for e in es if e['type']=='usage'];reported=lambda k:sum(e.get(k,0) for e in usage)
 phases={}
 for c in calls:
  phase=c.get('phase') or ('plan_review' if c['machine'].startswith('plan_') and c['machine']!='plan_gate' else 'bookkeeping' if c['machine']=='planner' else 'gate' if c['machine']=='plan_gate' else 'validation' if c['machine']=='validator' else 'implementation');p=phases.setdefault(phase,{'input':0,'output':0,'calls':0});p['calls']+=1;p['input']+=c.get('inputTokens') or 0;p['output']+=c.get('outputTokens') or 0
 return {'input':reported('inputTokens'),'output':reported('outputTokens'),'io':reported('inputTokens')+reported('outputTokens'),'cache_read':reported('cachedReadTokens'),'cache_write':reported('cachedWriteTokens'),'cache_read_reports':sum('cachedReadTokens' in e for e in usage),'usage_reports':len(usage),'model_calls':sum(e['type']=='machine' and e.get('status')=='running' and e.get('machine') not in ['planner','plan_gate'] for e in es),'doer_calls':sum(c['machine']=='doer' for c in calls),'validator_calls':sum(c['machine']=='validator' for c in calls),'phases':phases}
def elapsed_seconds(record,at=None):
 at=at or now()
 if record.get('segments'):
  return round(sum((datetime.fromisoformat(segment.get('finished') or at)-datetime.fromisoformat(segment['started'])).total_seconds() for segment in record['segments']),1)
 return round((datetime.fromisoformat(record.get('finished') or at)-datetime.fromisoformat(record['started'])).total_seconds(),1)
def refresh():
 data=json.loads((BASE/'dataset.json').read_text())
 for record in data['runs']:
  _,target,run,out=paths(record['mode']);es=events(run);record['metrics']=metrics(es)
  state=run/'batch-state.json'
  if state.exists():
   bs=json.loads(state.read_text());record['tasks_done']=len(bs.get('done',[]));record['commits']=len(bs.get('commits',[]))
  if record.get('started'):
   record['wall_elapsed_seconds']=round((datetime.fromisoformat(record.get('finished') or now())-datetime.fromisoformat(record['started'])).total_seconds(),1)
   record['elapsed_seconds']=elapsed_seconds(record)
 data['updated']=now();write(BASE/'dataset.json',data)
 template=(BASE/'one-pager.template.html').read_text()
 page=module('visual008','tetris-008-visuals.py').render(template,data)
 (ROOT/'docs/tetris-008-efficiency-one-pager.html').write_text(page)
 return data
def update(mode,**fields):
 data=json.loads((BASE/'dataset.json').read_text());record=next(r for r in data['runs'] if r['mode']==mode);record.update(fields)
 if fields.get('finished') and record.get('segments'):record['segments'][-1]['finished']=fields['finished']
 write(BASE/'dataset.json',data)
def run_all():
 lock=(BASE/'sequential.lock').open('a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 data=json.loads((BASE/'dataset.json').read_text())
 for name,expected in data['shared_input_hashes'].items():
  if digest(BASE/'inputs'/name)!=expected:raise RuntimeError('Shared inputs changed after preparation')
 gate=module('preflight008','after-validation.py')
 for mode in MODES:
  record=next(r for r in json.loads((BASE/'dataset.json').read_text())['runs'] if r['mode']==mode)
  if record['status'] in ['accepted','failed','interrupted']:continue
  attaching=record['status']=='running'
  resuming=record['status']=='resume_pending'
  if record['status'] not in ['queued','running','resume_pending']:raise RuntimeError('Invalid trial state; inspect before continuing.')
  name,target,run,out=paths(mode)
  if not attaching and not resuming and events(run):raise RuntimeError('Refusing to overwrite an existing run history')
  if not attaching and not resuming and digest(run/'plan.md')!=record['initial_plan_hash']:raise RuntimeError('Initial plan changed after preparation')
  for relative,expected in record['config_hashes'].items():
   if digest(target/'.assembly-lines'/relative)!=expected:raise RuntimeError('Assembly line changed after preparation')
  if attaching:
   latest=next((e for e in reversed(events(run)) if e['type']=='run'),{})
   if latest.get('status') not in ['finished','failed','stopped'] and gate.daemon_status(ROOT).get('run')!=name:raise RuntimeError('Recorded trial is not alive; no automatic worker recovery.')
  else:
   gate.preflight(ROOT,BASE/'daemon.log')
   if resuming:
    record['status']='running';record['segments'].append({'started':now()});record.pop('finished',None);record.pop('failure',None)
    data=json.loads((BASE/'dataset.json').read_text());data['runs'][MODES.index(mode)]=record;write(BASE/'dataset.json',data)
   else:update(mode,status='running',started=now())
  refresh()
  command=[str(ROOT/'bin/factory'),'--run',name,'--target',str(target),'--line',LINES[mode],'--seed',str(BASE/'inputs/seed.md'),'--attempts',str(ATTEMPTS),'--plan-rounds','5']
  try:
   if not attaching:
    started=subprocess.run(command,cwd=ROOT,env=env(),text=True,capture_output=True,timeout=30);(out/'start.log').open('a').write('\n'+now()+'\n'+started.stdout+started.stderr)
    if started.returncode:raise RuntimeError('Factory start failed; see start.log')
   current=next(r for r in json.loads((BASE/'dataset.json').read_text())['runs'] if r['mode']==mode)
   elapsed=elapsed_seconds(current)
   deadline=time.monotonic()+max(0,90*60-elapsed)
   while True:
    es=events(run);last=next((e for e in reversed(es) if e['type']=='run'),{})
    if last.get('status') in ['finished','failed','stopped']:break
    if time.monotonic()>deadline:
     subprocess.run([str(ROOT/'bin/factory'),'stop',name],cwd=ROOT,env=env(),capture_output=True,timeout=30);raise RuntimeError('90-minute trial limit reached; stopped and retained')
    refresh();time.sleep(10)
   if last['status']=='finished':
    check=subprocess.run([sys.executable,str(ROOT/'tools/experiments/check-batch-product.py'),str(target),str(run/'plan.md')],cwd=ROOT,text=True,capture_output=True,timeout=240)
    (out/'acceptance.json').write_text(check.stdout);(out/'acceptance.stderr').write_text(check.stderr)
    update(mode,status='accepted' if check.returncode==0 else 'failed',failure=None if check.returncode==0 else 'External acceptance failed; see acceptance.json',finished=now())
   else:update(mode,status='failed',failure=last.get('text') or last['status'],finished=now())
  except Exception as error:
   # Do not start another target until this daemon is confirmed idle.
   try:
    status=gate.daemon_status(ROOT)
    if status.get('run'):subprocess.run([str(ROOT/'bin/factory'),'stop',name],cwd=ROOT,env=env(),capture_output=True,timeout=30)
   except Exception:pass
   update(mode,status='failed',failure=str(error),finished=now())
  for filename in ['record.jsonl','plan.md','batch-state.json','plan-review.json']:
   if (run/filename).exists():shutil.copy2(run/filename,out/filename)
  refresh()
  # No provider repair, budget change, plan patch or automatic fresh retry.
  # An ordinary failure remains a failed observation; the next queued line may run.
 print('Sequential study finished. Inspect the one-pager and raw dataset.')
def resume_ralph():
 lock=(BASE/'sequential.lock').open('a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 data=json.loads((BASE/'dataset.json').read_text());batches=next(r for r in data['runs'] if r['mode']=='implement-in-batches')
 if batches['status'] not in ['accepted','failed','interrupted']:raise RuntimeError('Wait until batches has finished before resuming Ralph.')
 record=next(r for r in data['runs'] if r['mode']=='ralph')
 if record['status'] not in ['interrupted','failed']:raise RuntimeError('Ralph must be stopped before explicit resume.')
 name,target,run,out=paths('ralph');state=json.loads((run/'batch-state.json').read_text())
 if state['active'] is None:raise RuntimeError('No unfinished Ralph unit to resume.')
 gate=module('resume_gate008','after-validation.py');gate.preflight(ROOT,BASE/'daemon.log')
 stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ');history=out/'resume-history'/stamp;history.mkdir(parents=True)
 write(history/'result-before.json',record)
 for filename in ['record.jsonl','plan.md','batch-state.json','plan-review.json']:
  if (run/filename).exists():shutil.copy2(run/filename,history/filename)
 record.setdefault('segments',[{'started':record['started'],'finished':record['finished']}])
 record.setdefault('resumes',[]).append({'requested_at':now(),'previous_status':record['status'],'previous_failure':record.get('failure'),'preserved_task':state['active']['work_item'],'preserved_done':state['done'],'attempt_limit_per_invocation':ATTEMPTS,'reason':'User requested completing the same Ralph observation after batches finished; preserve prior usage, work and acceptance.'})
 record['status']='resume_pending';write(BASE/'dataset.json',data);refresh();lock.close();start()
def start():
 with (BASE/'runner.log').open('ab') as log:
  p=subprocess.Popen([sys.executable,str(Path(__file__).resolve()),'run'],cwd=ROOT,env=env(),stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
 (BASE/'runner.pid').write_text(str(p.pid)+'\n');print('Sequential runner PID',p.pid)
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('command',choices=['prepare','start','run','status','resume-ralph']);args=parser.parse_args()
 try:
  if args.command=='prepare':prepare()
  elif args.command=='start':start()
  elif args.command=='run':run_all()
  elif args.command=='resume-ralph':resume_ralph()
  else:
   for r in refresh()['runs']:print(r['id'],r['status'],f"{r.get('tasks_done',0)}/13",r['metrics']['io'],'recorded I/O')
 except Exception as error:print(str(error),file=sys.stderr);raise SystemExit(1)
