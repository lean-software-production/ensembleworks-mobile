#!/usr/bin/env python3
"""One bounded, explicitly intervened E02 recovery; never edits product or validation."""
import hashlib, json, os, socket, subprocess, sys, time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'docs/experiments/tetris-007';W=Path('/workspaces/tetris-007-experiments/contract-01/E02');NAME='tetris-007-e02-r5'
OUT=BASE/'maintenance/E02-recovery.json'
def request(payload):
    address='/tmp/factory-'+hashlib.sha256(str(W/'factory/runs').encode()).hexdigest()[:24]+'.sock'
    with socket.socket(socket.AF_UNIX,socket.SOCK_STREAM) as s:
        s.settimeout(3);s.connect(address);s.sendall((json.dumps(payload)+'\n').encode());s.shutdown(socket.SHUT_WR);return json.loads(s.recv(65536))
def main():
    if OUT.exists():raise RuntimeError('Recovery already attempted; refuse duplicate')
    if request({'command':'status'}).get('run'):raise RuntimeError('Daemon busy')
    events=[json.loads(l) for l in (W/'factory/runs'/NAME/'record.jsonl').read_text().splitlines()]
    diagnostic=next(e for e in reversed(events) if e['type']=='diagnostic' and e.get('machine')=='validator')
    state={'status':'starting','original_diagnostic':diagnostic,'intervention':'One resumed segment, same runner/models/seed/accepted plan. Deliver preserved negative validator evidence to doer; independent validator must check correction. Attempt budget restarts on resume; cumulative usage and historical failures retained. This is an intervened observation, not a fresh comparison.'}
    def save():OUT.write_text(json.dumps(state,indent=2)+'\n')
    save()
    result=BASE/'cohorts/contract-01/results'
    with (BASE/'maintenance/E02-recovery-supervisor.log').open('ab') as log:
        proc=subprocess.Popen([sys.executable,str(ROOT/'tools/experiments/supervise.py'),'--cohort','contract-01','--worktrees',str(W.parent),'--first-trial','5','--trials','1','--configs','E02','--resume','--resume-reason','Maintenance recovery after attached-JSON parse failure; preserve negative reachable-fixture validator finding.'],cwd=ROOT,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
    state['supervisor_pid']=proc.pid;save()
    deadline=time.monotonic()+300
    while time.monotonic()<deadline and proc.poll() is None:
        es=[json.loads(l) for l in (W/'factory/runs'/NAME/'record.jsonl').read_text().split('\n')[:-1]]
        new=es[len(events):]
        doer=next((e for e in reversed(new) if e['type']=='machine' and e.get('machine')=='doer'),{})
        if doer.get('status')=='running':
            message='Maintenance recovery: preserve and address the prior independent validator rejection below. It failed parsing because JSON was attached to prose, not because it accepted this work. Correct the product through this doer call; require independent revalidation. Do not mark task complete yourself. Prior validator evidence:\n'+diagnostic['outputTail']
            reply=request({'command':'say','name':NAME,'machine':'doer','text':message})
            if reply.get('ok'):state.update(status='evidence_delivered',delivery=reply);save();return
        time.sleep(2)
    # Never leave a recovery running if its essential finding could not be delivered.
    state.update(status='delivery_failed',stop=request({'command':'stop','name':NAME}));save()
if __name__=='__main__':main()
