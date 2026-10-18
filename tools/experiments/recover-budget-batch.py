#!/usr/bin/env python3
"""Explicit reviewed-prefix recovery after an E07 budget stop.
Archives all product work before restoring the last accepted commit. Never marks
partial tasks complete or fabricates validation/commit receipts.
"""
import argparse,hashlib,json,os,re,shutil,subprocess
from datetime import datetime,timezone
from pathlib import Path

def git(target,*args):return subprocess.check_output(['git','-C',str(target),*args],text=True).strip()
def transition(state,review,contract,selection,snapshot,base,finding):
    old=state['active'];batch=next(b for b in contract['batches'] if b['id']==old['id']);ids=selection['task_ids']
    if not ids or ids!=old['task_ids'][:len(ids)] or len(ids)>=len(old['task_ids']) or ids[-1] not in batch['split_after']:raise ValueError('Recovery must use a proper reviewed prefix split of the fixed active batch')
    if set(ids)&set(state['done']):raise ValueError('Recovery includes previously completed work')
    if review.get('status')!='accepted' or review.get('decision',{}).get('satisfied') is not True:raise ValueError('Independent accepted plan checkpoint required')
    new=json.loads(json.dumps(state));active=dict(old)
    active.update(task_ids=ids,work_item=f"Batch {old['id']}: {','.join(ids)}",selected_at=datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z'),budget=selection)
    active['acceptance']=[a for a in old['acceptance'] if a['task_id'] in ids]
    active['requirements']=list(dict.fromkeys(r for t in contract['tasks'] if t['id'] in ids for r in t['requirements']))
    active['recovery']={'reason':'Explicit user-authorized reviewed fallback after budget overrun','archived_product':str(snapshot/'product'),'base_commit':base,'known_validator_findings':finding,'instruction':'Recover only this selected prefix from the archived unvalidated work, fix its findings, preserve accepted work. Do not restore unrelated terminal-lifecycle changes or claim validation. Remaining tasks stay pending.'}
    new.setdefault('recoveries',[]).append({'previous_active':old,'new_task_ids':ids,'snapshot':str(snapshot),'base_commit':base,'time':active['selected_at']})
    new['active']=active
    updated_review=json.loads(json.dumps(review));updated_review.pop('task',None)
    return new,updated_review

def main(args):
    w=args.worktree.resolve();target=w/'tetris'/args.run;run=w/'factory/runs'/args.run
    record=run/'record.jsonl';events=[json.loads(l) for l in record.read_text().split('\n')[:-1] if l]
    last=next(e for e in reversed(events) if e['type']=='run')
    if last['status'] not in ['stopped','failed']:raise RuntimeError('Trial must be stopped/failed')
    state=json.loads((run/'batch-state.json').read_text());review=json.loads((run/'plan-review.json').read_text());contract=json.loads(re.search(r'```batch-plan\s*\n([\s\S]*?)\n```',(run/'plan.md').read_text())[1])
    old=state['active'];batch=next(b for b in contract['batches'] if b['id']==old['id']);end=old['task_ids'].index(args.split_after)+1;ids=old['task_ids'][:end]
    config=json.loads((target/'.assembly-lines/batch-budget.json').read_text())
    code="const p=require(process.argv[1]),x=JSON.parse(require('node:fs').readFileSync(0,'utf8'));console.log(JSON.stringify(p.select(x.ids,{split_after:[]},x.tasks,x.config,x.history)));"
    selection=json.loads(subprocess.check_output(['node','-e',code,str(w/'tools/experiments/batch-budget.cjs')],input=json.dumps({'ids':ids,'tasks':contract['tasks'],'config':config,'history':state['commits']}),text=True))
    base=git(target,'rev-parse','HEAD');assert state['commits'][-1]['commit']==base,'HEAD must be last accepted receipt'
    if git(target,'diff','--cached','--name-only','--','.',':(exclude).assembly-lines'):raise RuntimeError('Staged product edits require separate review')
    finding=[];text=''
    for e in events:
        if e['type']=='machine' and e.get('machine')=='validator' and e.get('status')=='running':text=''
        elif e['type']=='text' and e.get('machine')=='validator':text+=e.get('text','')
    for line in text.splitlines()[::-1]:
        try:
            result=json.loads(line)
            if isinstance(result,dict) and isinstance(result.get('findings'),list):finding=result['findings'];break
        except ValueError:pass
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');snapshot=run/'budget-recoveries'/stamp
    new,updated_review=transition(state,review,contract,selection,snapshot,base,finding)
    print(json.dumps({'previous':old['task_ids'],'new':ids,'remaining':[i for i in old['task_ids'] if i not in ids],'base_commit':base,'finding_count':len(finding),'snapshot':str(snapshot),'apply':args.apply},indent=2))
    if not args.apply:return
    snapshot.mkdir(parents=True)
    for name in ['plan.md','plan-review.json','batch-state.json','record.jsonl']:
        shutil.copy2(run/name,snapshot/name)
    shutil.copytree(target,snapshot/'product',ignore=shutil.ignore_patterns('.assembly-lines','node_modules','.git'))
    untracked=subprocess.check_output(['git','-C',str(target),'ls-files','--others','--exclude-standard','-z','--','.',':(exclude).assembly-lines']).decode().split('\0')
    for name in filter(None,untracked):
        p=target/name;copy=snapshot/'product'/name
        if not p.is_file() or not copy.is_file() or hashlib.sha256(p.read_bytes()).digest()!=hashlib.sha256(copy.read_bytes()).digest():raise RuntimeError('Untracked file archive mismatch: '+name)
    # Snapshot verified; restore product paths only, never machine config or credentials.
    subprocess.run(['git','-C',str(target),'restore','--source',base,'--worktree','--','.',':(exclude).assembly-lines'],check=True)
    for name in filter(None,untracked):(target/name).unlink()
    for name,value in [('batch-state.json',new),('plan-review.json',updated_review)]:
        temp=run/(name+'.recovery.tmp');temp.write_text(json.dumps(value,indent=2)+'\n');temp.replace(run/name)
    note={'type':'recovery','time':datetime.now(timezone.utc).isoformat(),'reason':'User-authorized reviewed fallback','previous_work_item':old['work_item'],'new_work_item':new['active']['work_item'],'snapshot':str(snapshot),'baseline_commit':base,'done_unchanged':state['done']}
    (snapshot/'intervention.json').write_text(json.dumps(note,indent=2)+'\n')
    print('Recovery applied. No product commit or completion was made; resume must independently validate the prefix.')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--worktree',type=Path,required=True);p.add_argument('--run',required=True);p.add_argument('--split-after',required=True);p.add_argument('--apply',action='store_true');args=p.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9][\w.-]*',args.run):p.error('Invalid run')
    main(args)
