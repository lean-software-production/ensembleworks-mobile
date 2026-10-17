#!/usr/bin/env python3
"""Run three fresh trials per configuration, four isolated factory daemons.
No automatic repair/resume: failures are retained as experimental observations.
"""
import argparse, concurrent.futures, fcntl, hashlib, json, os, shutil, subprocess, time
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
RESULTS=ROOT/'docs/experiments/tetris-007/results'
FIRST_TRIAL=1
TRIALS=3
COHORT=''
HALT=__import__('threading').Event()
MODEL_ERRORS=set()
ERROR_LOCK=__import__('threading').Lock()

def now(): return datetime.now(timezone.utc).isoformat()
def atomic(path, value):
    path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix('.tmp'); temp.write_text(json.dumps(value,indent=2)+'\n'); temp.replace(path)
def git(w,*args):return subprocess.check_output(['git','-C',str(w),*args],text=True).strip()
def events(run):
    path=run/'record.jsonl'
    return [json.loads(l) for l in path.read_text().split('\n')[:-1] if l.strip()] if path.exists() else []
def summarize(es):
    totals={}; calls={}
    for e in es:
        n=e.get('machine','')
        if e['type']=='machine' and e.get('status')=='running': calls[n]=calls.get(n,0)+1
        if e['type']=='usage':
            t=totals.setdefault(n,{'reports':0,'inputTokens':0,'outputTokens':0,'cachedReadTokens':0,'cachedWriteTokens':0,'cacheReadReports':0,'cacheWriteReports':0})
            t['reports']+=1
            for k in ['inputTokens','outputTokens']: t[k]+=e.get(k,0)
            for k,c in [('cachedReadTokens','cacheReadReports'),('cachedWriteTokens','cacheWriteReports')]:
                if k in e: t[k]+=e[k];t[c]+=1
    return {'machines':totals,'calls':calls,'diagnostics':sum(e['type']=='diagnostic' for e in es)}

def configuration(code, worktree):
    config=RESULTS/f'{code}.json'; state={'experiment':code,'worktree':str(worktree),'status':'running','started':now(),'trials':[]};atomic(config,state)
    for trial in range(FIRST_TRIAL,FIRST_TRIAL+TRIALS):
        name=f'tetris-007-{code.lower()}-r{trial}'; target=worktree/'tetris'/name; run=worktree/'factory/runs'/name
        record={'id':name,'experiment':code,'trial':trial,'started':now(),'status':'starting','worktree':str(worktree),'target':str(target),'branch':git(worktree,'branch','--show-current'),'pre_run_commit':git(worktree,'rev-parse','HEAD'),'pre_run_tag':f'{name}-before-run','cohort':COHORT,'planned_trials_per_configuration':TRIALS}
        git(worktree,'tag','-a',record['pre_run_tag'],'-m',f'Frozen experiment {name} immediately before execution')
        out=RESULTS/name;out.mkdir(parents=True,exist_ok=True)
        shutil.copytree(worktree/'docs/experiments/tetris-007/inputs',out/'inputs',dirs_exist_ok=True)
        record['input_hashes']={str(p.relative_to(out/'inputs')):hashlib.sha256(p.read_bytes()).hexdigest() for p in (out/'inputs').rglob('*') if p.is_file()}
        atomic(out/'result.json',record); state['trials'].append(record);atomic(config,state)
        env=dict(os.environ,TS_NODE_TRANSPILE_ONLY='true',PATH=str(worktree/'tools/pi-rpc-acp')+os.pathsep+os.environ['PATH'])
        try:
            command=[str(worktree/'bin/factory'),'--run',name,'--target',str(target),'--line','efficient','--seed',str(worktree/'docs/experiments/tetris-007/inputs/seed.md')]
            start=subprocess.run(command,cwd=worktree,env=env,text=True,capture_output=True,timeout=30)
            (out/'start.log').write_text(start.stdout+start.stderr)
            if start.returncode: raise RuntimeError(start.stderr.strip() or start.stdout.strip())
            record['status']='running';atomic(out/'result.json',record);atomic(config,state)
            deadline=time.monotonic()+10800
            while True:
                es=events(run); latest=next((e for e in reversed(es) if e['type']=='run'),{})
                record['progress']={'last_event':es[-1].get('time') if es else None,'machine':next((e.get('machine') for e in reversed(es) if e['type']=='machine'),None),'events':len(es)}
                atomic(out/'result.json',record);atomic(config,state)
                if latest.get('status') in ['finished','failed','stopped']:
                    if any(e['type']=='diagnostic' and 'error' in e.get('modelStopReasons',[]) for e in es):
                        with ERROR_LOCK:
                            MODEL_ERRORS.add(code)
                            if len(MODEL_ERRORS)>=2 and not HALT.is_set():
                                HALT.set()
                                atomic(RESULTS/'incident.json',{'status':'halted','reason':'Provider error endings in two configurations triggered the cohort circuit breaker.','experiments':sorted(MODEL_ERRORS)})
                    break
                if HALT.is_set():
                    subprocess.run([str(worktree/'bin/factory'),'stop',name],cwd=worktree,env=env,capture_output=True,timeout=30)
                    record['intervention']='Stopped after provider errors in two configurations; cohort circuit breaker.'
                    continue
                if time.monotonic()>deadline:
                    subprocess.run([str(worktree/'bin/factory'),'stop',name],cwd=worktree,env=env,capture_output=True,timeout=30)
                    raise RuntimeError('Three-hour trial ceiling reached; run stopped and retained.')
                time.sleep(5)
            record['factory_status']=latest['status']; record['status']=latest['status'];record['usage']=summarize(es)
            if latest.get('text'):record['failure']=latest['text']
            if latest['status']=='finished':
                check=subprocess.run(['python3',str(ROOT/'tools/experiments/check-product.py'),str(target),str(run/'plan.md')],text=True,capture_output=True,timeout=240)
                (out/'acceptance.json').write_text(check.stdout)
                record['acceptance_passed']=check.returncode==0
                record['status']='checks_passed_pending_review' if check.returncode==0 else 'acceptance_failed'
            record['result_commit']=git(worktree,'rev-parse','HEAD')
        except Exception as error:
            record['status']='orchestration_failed'; record['failure']=str(error)
        finally:
            record['finished']=now()
            for filename in ['record.jsonl','plan.md','plan-review.json','run.json']:
                if (run/filename).exists():shutil.copy2(run/filename,out/filename)
            if run.exists():
                for p in run.iterdir():
                    if p.is_dir(): shutil.copytree(p,out/p.name,dirs_exist_ok=True)
            for filename in ['VERIFICATION.md','HANDOFF.md','README.md']:
                if (target/filename).exists():shutil.copy2(target/filename,out/filename)
            atomic(out/'result.json',record);atomic(config,state)
    state['status']='complete';state['finished']=now();atomic(config,state)
    return code

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--worktrees',default='/workspaces/tetris-007-experiments');p.add_argument('--first-trial',type=int,default=1);p.add_argument('--trials',type=int,default=3);p.add_argument('--cohort',default='');a=p.parse_args()
    if a.first_trial<1 or a.trials<1:p.error('Trial numbers/count must be positive.')
    if a.cohort and not __import__('re').fullmatch(r'[a-zA-Z0-9-]+',a.cohort):p.error('Invalid cohort name.')
    FIRST_TRIAL=a.first_trial;TRIALS=a.trials;COHORT=a.cohort
    if COHORT:RESULTS=ROOT/'docs/experiments/tetris-007/cohorts'/COHORT/'results'
    report_command=['python3',str(ROOT/'tools/experiments/report.py'),'--first-trial',str(FIRST_TRIAL),'--trials',str(TRIALS),'--cohort',COHORT]
    RESULTS.mkdir(parents=True,exist_ok=True)
    lock=(RESULTS/'supervisor.lock').open('w')
    fcntl.flock(lock,fcntl.LOCK_EX | fcntl.LOCK_NB)
    if list(RESULTS.glob('tetris-007-*/result.json')):raise RuntimeError('Existing trials detected; refusing to overwrite observations.')
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        jobs=[pool.submit(configuration,c,Path(a.worktrees)/c) for c in ['E00','E01','E02','E03']]
        pending=set(jobs)
        while pending:
            done,pending=concurrent.futures.wait(pending,timeout=30,return_when=concurrent.futures.FIRST_COMPLETED)
            for j in done: print(j.result(), 'complete',flush=True)
            subprocess.run(report_command,check=True)
    subprocess.run(report_command,check=True)
