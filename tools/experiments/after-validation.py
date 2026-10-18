#!/usr/bin/env python3
"""Gate a new cohort on local regression results, an Opus smoke test, and E01 completion."""
import argparse, hashlib, json, os, re, shutil, socket, subprocess, sys, time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]

def passed_suite(text):
    match=re.search(r'(?m)^(\d+) scenarios? \((\d+) passed\)\s*$',text)
    return bool(match and int(match[1])>0 and match[1]==match[2])

def daemon_status(worktree):
    address='/tmp/factory-'+hashlib.sha256(str(worktree/'factory/runs').encode()).hexdigest()[:24]+'.sock'
    with socket.socket(socket.AF_UNIX,socket.SOCK_STREAM) as sock:
        sock.settimeout(2);sock.connect(address);sock.sendall(b'{"command":"status"}\n');sock.shutdown(socket.SHUT_WR)
        return json.loads(sock.recv(65536))

def preflight(worktree, log):
    try: reply=daemon_status(worktree)
    except (OSError,ValueError):
        env=dict(os.environ,TS_NODE_TRANSPILE_ONLY='true',PATH=str(worktree/'tools/pi-rpc-acp')+os.pathsep+os.environ['PATH'])
        with log.open('ab') as output:
            subprocess.Popen([str(worktree/'bin/factory'),'--daemon'],cwd=worktree,env=env,stdin=subprocess.DEVNULL,stdout=output,stderr=output,start_new_session=True)
        for _ in range(200):
            try:reply=daemon_status(worktree);break
            except (OSError,ValueError):time.sleep(.1)
        else:raise RuntimeError(f'Daemon did not pass preflight: {worktree}')
    if not reply.get('ok') or not reply.get('running') or reply.get('run'):raise RuntimeError(f'Daemon is not idle: {worktree}')

def main(args):
    cohort=ROOT/'docs/experiments/tetris-007/cohorts'/args.cohort
    cohort.mkdir(parents=True,exist_ok=True)
    state={'cohort':args.cohort,'status':'awaiting_validation','trials_per_configuration':1,'first_trial':args.first_trial,'worktrees':str(args.worktrees)}
    def save():
        temp=cohort/'launch.tmp';temp.write_text(json.dumps(state,indent=2)+'\n');temp.replace(cohort/'launch.json')
    save();deadline=time.monotonic()+21600
    try:
        while True:
            text=args.suite_log.read_text() if args.suite_log.exists() else ''
            smoke=json.loads(args.smoke_result.read_text()) if args.smoke_result.exists() else None
            if smoke is not None and not smoke.get('passed'):raise RuntimeError('Opus smoke test failed; no cohort launched.')
            if re.search(r'(?m)^\d+ scenarios?\b',text) and not passed_suite(text):raise RuntimeError('Factory regression suite did not pass; no cohort launched.')
            if passed_suite(text) and smoke and smoke.get('passed'):break
            if time.monotonic()>deadline:raise RuntimeError('Validation gate timed out; no cohort launched.')
            time.sleep(5)
        validation=cohort/'validation';validation.mkdir(exist_ok=True)
        shutil.copy2(args.suite_log,validation/'factory-suite.log');shutil.copy2(args.smoke_result,validation/'opus-smoke.json')
        if smoke.get('record'):shutil.copy2(smoke['record'],validation/'opus-smoke-record.jsonl')
        state['status']='awaiting_previous_cohort';save()
        previous=ROOT/'docs/experiments/tetris-007/cohorts/restart-01/results/E01.json'
        while json.loads(previous.read_text()).get('status')!='complete':
            if time.monotonic()>deadline:raise RuntimeError('E01 wait timed out; no cohort launched.')
            time.sleep(5)
        state['status']='preflight';save()
        for code in args.configs:preflight(args.worktrees/code,cohort/f'daemon-{code}.log')
        out=cohort/'results';out.mkdir(exist_ok=True)
        with (out/'supervisor.log').open('ab') as log:
            child=subprocess.Popen([sys.executable,str(ROOT/'tools/experiments/supervise.py'),'--cohort',args.cohort,'--worktrees',str(args.worktrees),'--first-trial',str(args.first_trial),'--trials','1','--configs',*args.configs],cwd=ROOT,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
        (out/'supervisor.pid').write_text(str(child.pid)+'\n')
        state.update(status='launched',supervisor_pid=child.pid);save()
    except Exception as error:
        state.update(status='blocked',reason=str(error));save();raise

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--configs',nargs='+',choices=['E00','E01','E02','E03','E04','E05','E06'],default=['E00','E01','E02','E03']);p.add_argument('--cohort',required=True);p.add_argument('--worktrees',required=True,type=Path);p.add_argument('--first-trial',type=int,required=True);p.add_argument('--suite-log',type=Path,required=True);p.add_argument('--smoke-result',type=Path,required=True);a=p.parse_args()
    if not re.fullmatch(r'[a-zA-Z0-9-]+',a.cohort) or a.first_trial<1:p.error('Invalid cohort or trial')
    main(a)
