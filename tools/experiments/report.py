#!/usr/bin/env python3
"""Refresh the experiment ledger from live records and archived outcomes."""
import csv, html, io, json, re, statistics
from datetime import datetime, timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'docs/experiments/tetris-007'
RESULTS=BASE/'results'

def read_events(path):
    if not path.exists():return []
    return [json.loads(s) for s in path.read_text().split('\n')[:-1] if s.strip()]
def result(text):
    for s in text.rstrip().splitlines()[::-1]:
        try:
            value=json.loads(s)
            if isinstance(value,dict):return value
        except ValueError:pass
    return {}
def calls(es):
    active={};rows=[];task='';attempts={}
    for e in es:
        n=e.get('machine','')
        if e['type']=='machine' and e.get('status')=='running':active[n]={'machine':n,'started':e['time'],'text':'','task':task}
        elif n in active:
            c=active[n]
            if e['type']=='text':c['text']+=e.get('text','')
            if e['type']=='usage':
                for k in ['inputTokens','outputTokens','cachedReadTokens','cachedWriteTokens']:c[k]=e.get(k)
            if e['type']=='machine' and e.get('status')!='running':
                c['status']=e['status'];c['finished']=e['time'];r=result(c.pop('text'))
                if n=='doer':
                    task=r.get('task') or task or 'unidentified';c['task']=task;attempts[task]=attempts.get(task,0)+1;c['attempt']=attempts[task]
                c['phase']='plan_review' if n.startswith('plan_') and n!='plan_gate' else 'bookkeeping' if n=='planner' else 'gate' if n=='plan_gate' else 'implementation'
                rows.append(c);del active[n]
    for c in active.values():
        c.pop('text');c['status']='running';rows.append(c)
    return rows

def refresh():
    RESULTS.mkdir(parents=True,exist_ok=True)
    summary=[];callrows=[]
    for code in ['E00','E01','E02','E03']:
        worktree=Path('/workspaces/tetris-007-experiments')/code
        for trial in range(1,4):
            name=f'tetris-007-{code.lower()}-r{trial}';folder=RESULTS/name;record=folder/'result.json'
            state=json.loads(record.read_text()) if record.exists() else {'status':'queued'}
            es=read_events(worktree/'factory/runs'/name/'record.jsonl');cs=calls(es)
            for c in cs:callrows.append({'experiment':code,'trial':trial,'id':name,**c})
            us=[e for e in es if e['type']=='usage']
            measured=lambda k:sum(e[k] for e in us if e.get(k) is not None)
            coverage=lambda k:sum(e.get(k) is not None for e in us)
            plan=worktree/'factory/runs'/name/'plan.md'
            complete=len(re.findall(r'^- \[[xX]\] \d+\.',plan.read_text(),re.M)) if plan.exists() else 0
            active=0;started=None
            for e in es:
                if e['type']=='run':
                    t=datetime.fromisoformat(e['time'].replace('Z','+00:00'))
                    if e['status']=='running':started=t
                    elif started:active+=(t-started).total_seconds();started=None
            if started:active+=(datetime.now(timezone.utc)-started).total_seconds()
            s={'experiment':code,'trial':trial,'id':name,'status':state['status'],'tasks_complete':complete,'calls_started':sum(e['type']=='machine' and e.get('status')=='running' for e in es),'usage_reports':len(us),'input':measured('inputTokens'),'output':measured('outputTokens'),'cache_read_reported':measured('cachedReadTokens'),'cache_write_reported':measured('cachedWriteTokens'),'cache_read_reports':coverage('cachedReadTokens'),'cache_write_reports':coverage('cachedWriteTokens'),'active_seconds':round(active,1),'failure':state.get('failure'),'first_attempt_doer_input':sum(c.get('inputTokens') or 0 for c in cs if c['machine']=='doer' and c.get('attempt')==1),'diagnostics':sum(e['type']=='diagnostic' for e in es)}
            s['recorded_io']=s['input']+s['output'];summary.append(s)
    onepager=ROOT/'docs/tetris-007-experiments-one-pager.html'
    page=onepager.read_text()
    for code in ['E00','E01','E02','E03']:
        group=[s for s in summary if s['experiment']==code]
        running=sum(s['status'] in ['starting','running'] for s in group)
        finished=sum(s['status'] not in ['queued','starting','running'] for s in group)
        label=f'{finished}/3 recorded' + (' · running' if running else '') if finished or running else 'Queued'
        pattern=r'(<tr data-experiment="'+code+r'"[\s\S]*?<span class="badge">)[^<]*(</span>)'
        page=re.sub(pattern,lambda m:m[1]+label+m[2],page,count=1)
    onepager.write_text(page)
    payload={'updated':datetime.now(timezone.utc).isoformat(),'trials':summary,'note':'Partial tokens omit active calls. Missing cache reports are unknown. Checks passed remains pending review of preserved acceptance and validator evidence.'}
    (RESULTS/'summary.json').write_text(json.dumps(payload,indent=2)+'\n')
    if callrows:
        fields=['experiment','trial','id','machine','phase','task','attempt','started','finished','status','inputTokens','outputTokens','cachedReadTokens','cachedWriteTokens']
        with (RESULTS/'calls.csv').open('w',newline='') as f:
            writer=csv.DictWriter(f,fields,extrasaction='ignore',lineterminator='\n');writer.writeheader();writer.writerows(callrows)
    lines=['# Tetris 007 measured pilot',f"Updated {payload['updated']}",'','| Experiment / trial | Status | Tasks | Recorded I/O | Cache read / coverage | Calls | Active min |','| --- | --- | ---: | ---: | ---: | ---: | ---: |']
    for s in summary:lines.append(f"| {s['experiment']} / {s['trial']} | {s['status']} | {s['tasks_complete']}/13 | {s['recorded_io']:,} | {s['cache_read_reported']:,} / {s['cache_read_reports']}/{s['usage_reports']} reports | {s['calls_started']} | {s['active_seconds']/60:.1f} |")
    lines+=['','Partial totals omit active calls. Cache totals include only reported fields; absent does not mean zero. Local machines also count as calls. All failures stay in the dataset.','', 'A lower total from a failed or incomplete game is not evidence of improved efficiency. Final quality verdict requires reviewing retained acceptance clauses and validator evidence.']
    for code in ['E00','E01','E02','E03']:
        done=[s for s in summary if s['experiment']==code and s['status'] not in ['queued','starting','running']]
        if len(done)==3:
            vals=[s['recorded_io'] for s in done];eligible=sum(s['status']=='checks_passed_pending_review' for s in done)
            lines+=['',f"{code}: median observed I/O {statistics.median(vals):,.0f}, range {min(vals):,}–{max(vals):,}; {eligible}/3 passed automated checks pending evidence review. Includes failed runs; do not interpret as equivalent completed work unless quality matches."]
    (BASE/'results.md').write_text('\n'.join(lines)+'\n')
    rows=''.join('<tr>'+''.join(f'<td>{html.escape(str(v))}</td>' for v in [s['experiment']+' / '+str(s['trial']),s['status'],str(s['tasks_complete'])+'/13',f"{s['recorded_io']:,}",f"{s['cache_read_reported']:,} ({s['cache_read_reports']}/{s['usage_reports']} reports)",s['calls_started'],f"{s['active_seconds']/60:.1f}"])+'</tr>' for s in summary)
    style='<style>body{font:16px system-ui;background:#f7f3e8;color:#243d42;margin:2rem}main{max-width:1100px;margin:auto}h1{color:#176c65}table{width:100%;border-collapse:collapse;background:white}th,td{text-align:left;padding:.7rem;border-bottom:1px solid #ddd}th{background:#f2d16b}.scroll{overflow:auto}small{color:#52666a}</style>'
    (BASE/'results.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="30"><title>Tetris 007 live experiments</title>'+style+'<main><h1>Tetris 007 · Live experiments</h1><p>Four isolated configurations, three fresh trials each. <a href="../../tetris-007-experiments-one-pager.html">Protocol</a></p><small>Updated '+payload['updated']+'</small><div class="scroll"><table><thead><tr><th>Trial</th><th>Status</th><th>Tasks</th><th>Recorded I/O</th><th>Cache read</th><th>Calls</th><th>Active min</th></tr></thead><tbody>'+rows+'</tbody></table></div><p>Partial totals omit active calls. Missing cache reports are unknown. Failed runs remain in the dataset; lower usage from incomplete work is not a saving. Automated passes await acceptance/evidence review.</p><p><a href="results/summary.json">Summary JSON</a> · <a href="results/calls.csv">Per-call and phase CSV</a> · <a href="README.md">Execution details</a></p></main></html>')

if __name__=='__main__':refresh()
