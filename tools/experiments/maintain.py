#!/usr/bin/env python3
"""Workspace-local 30-minute maintenance timer. No overlapping worker calls."""
import argparse, fcntl, json, os, signal, subprocess, time
from datetime import datetime, timezone, timedelta
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
STATE=ROOT/'docs/experiments/tetris-007/maintenance'

def now():return datetime.now(timezone.utc)
def atomic(path,value):
    temp=path.with_suffix('.tmp');temp.write_text(json.dumps(value,indent=2)+'\n');temp.replace(path)
def can_stop(result):
    return result.get('stop_timer') is True and (result.get('stop_reason')=='needs_user_input' or (result.get('stop_reason')=='all_tested' and all(result.get('hypotheses',{}).get(c)=='tested' for c in ['E00','E01','E02','E03','E04'])))
def command(folder):
    return ['codex','exec','--cd',str(ROOT),'--sandbox','danger-full-access','--config','approval_policy="never"','--ephemeral','--json','--output-schema',str(Path(__file__).with_name('maintain-schema.json')),'--output-last-message',str(folder/'answer.json'),'-']
def run_worker(folder,timeout):
    folder.mkdir(parents=True)
    prompt=Path(__file__).with_name('maintain-prompt.txt').read_text()+'\nThis check-in ID: '+folder.name+'\n'
    with (folder/'events.jsonl').open('w') as out,(folder/'stderr.log').open('w') as err:
        child=subprocess.Popen(command(folder),cwd=ROOT,stdin=subprocess.PIPE,stdout=out,stderr=err,text=True,start_new_session=True)
        atomic(folder/'worker.json',{'pid':child.pid,'started':now().isoformat()})
        try:
            child.communicate(prompt,timeout=timeout)
            if child.returncode:raise RuntimeError(f'Maintenance agent exited with code {child.returncode}; see archived logs.')
            result=json.loads((folder/'answer.json').read_text())
            if not isinstance(result,dict) or not all(k in result for k in ['summary','actions','blockers','next_action','hypotheses','stop_timer','stop_reason']):raise RuntimeError('Missing structured maintenance result')
            return result
        except subprocess.TimeoutExpired:
            os.killpg(child.pid,signal.SIGTERM)
            try:child.wait(timeout=5)
            except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);child.wait()
            raise RuntimeError('Maintenance agent reached its 25-minute limit; stopped this worker, not factory runs.')
        except BaseException:
            if child.poll() is None:
                os.killpg(child.pid,signal.SIGTERM)
                try:child.wait(timeout=5)
                except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);child.wait()
            raise

def main(args):
    STATE.mkdir(parents=True,exist_ok=True)
    lock=(STATE/'timer.lock').open('w');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    (STATE/'timer.pid').write_text(str(os.getpid())+'\n')
    status={'status':'scheduled','interval_seconds':args.interval,'workspace':str(ROOT),'pid':os.getpid(),'started':now().isoformat(),'checkins':0,'runtime':'local; workspace must remain awake','worker_timeout_seconds':args.timeout}
    next_tick=time.monotonic()+(args.interval if args.delay_first else 0)
    def halt(_signum,_frame):raise KeyboardInterrupt
    signal.signal(signal.SIGTERM,halt)
    try:
        while not (STATE/'STOP').exists():
            remaining=max(0,next_tick-time.monotonic());status['next_check']= (now()+timedelta(seconds=remaining)).isoformat();atomic(STATE/'timer.json',status)
            if remaining:time.sleep(min(remaining,30));continue
            folder=STATE/'checkins'/now().strftime('%Y%m%dT%H%M%S%fZ')
            status.update(status='checking',last_check_started=now().isoformat(),current_check=str(folder.relative_to(ROOT)));atomic(STATE/'timer.json',status)
            try:
                result=run_worker(folder,args.timeout)
                atomic(STATE/'latest.json',result)
                with (STATE/'checkins.jsonl').open('a') as log:log.write(json.dumps({'time':now().isoformat(),'folder':str(folder),'result':result})+'\n')
                if can_stop(result):status.update(status='finished',stop_reason=result['stop_reason']);break
                status.pop('last_error',None)
            except Exception as error:status['last_error']=str(error)
            status['checkins']+=1;status.update(status='scheduled',last_check_finished=now().isoformat())
            next_tick+=args.interval
            if next_tick<time.monotonic():next_tick=time.monotonic()+args.interval
            if args.once:break
        if status['status']!='finished':status.update(status='stopped')
    except KeyboardInterrupt:status.update(status='stopped')
    finally:
        status['stopped_at']=now().isoformat();atomic(STATE/'timer.json',status)
        (STATE/'timer.pid').unlink(missing_ok=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--interval',type=int,default=1800);p.add_argument('--timeout',type=int,default=1500);p.add_argument('--delay-first',action='store_true');p.add_argument('--once',action='store_true');args=p.parse_args()
    if args.interval<60 or args.timeout<1 or args.timeout>=args.interval:p.error('Require interval >=60 and 0<timeout<interval')
    main(args)
