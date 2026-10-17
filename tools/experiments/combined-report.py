#!/usr/bin/env python3
"""Combined observational ledger; raw cohort files remain authoritative and untouched."""
import csv, html, importlib.util, json, re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'docs/experiments/tetris-007'
spec=importlib.util.spec_from_file_location('trial_report',Path(__file__).with_name('report.py'))
report=importlib.util.module_from_spec(spec);spec.loader.exec_module(report)
KEYS=['inputTokens','outputTokens','cachedReadTokens','cachedWriteTokens']
def totals(calls):
    return {k:{'reported':sum(c[k] for c in calls if c.get(k) is not None),'coverage':sum(c.get(k) is not None for c in calls),'calls':len(calls)} for k in KEYS}
def stamp_now():return datetime.now(timezone.utc).isoformat()
def progress_text():
    p=BASE/"maintenance/results.md"
    return p.read_text() if p.exists() else "Acceptance review remains pending."
def refresh():
    observations=[]; rows=[]
    for p in sorted(BASE.glob('**/tetris-007-*/result.json')):
        state=json.loads(p.read_text());name=state['id'];cohort=state.get('cohort') or 'pilot'
        w=Path(state['worktree']);live=w/'factory/runs'/name
        record=live/'record.jsonl'
        if not record.exists():record=p.parent/'record.jsonl'
        es=report.read_events(record); calls=report.calls(es)
        for c in calls:rows.append({'cohort':cohort,'id':name,**c})
        plan=live/'plan.md'
        if not plan.exists():plan=p.parent/'plan.md'
        complete=len(re.findall(r'^- \[[xX]\] \d+\.',plan.read_text(),re.M)) if plan.exists() else 0
        phases=defaultdict(list)
        for c in calls:phases[c.get('phase','active')].append(c)
        first={m:totals([next(c for c in calls if c['machine']==m)]) for m in ['doer','validator'] if any(c['machine']==m for c in calls)}
        active=0;start=None
        for e in es:
            if e['type']=='run':
                t=datetime.fromisoformat(e['time'].replace('Z','+00:00'))
                if e['status']=='running':start=t
                elif start:active+=(t-start).total_seconds();start=None
        if start:active+=(datetime.now(timezone.utc)-start).total_seconds()
        elapsed=(datetime.fromisoformat(state.get('finished') or stamp_now()).replace(tzinfo=timezone.utc)-datetime.fromisoformat(state['started']).replace(tzinfo=timezone.utc)).total_seconds() if state.get('started') else None
        observations.append({'elapsed_seconds':elapsed,'cohort':cohort,'experiment':state['experiment'],'id':name,'status':state['status'],'tasks':complete,'calls':len(calls),'usage':totals(calls),'phase_usage':{k:totals(v) for k,v in phases.items()},'first_implementation_validation':first,'resumes':state.get('resumes',[]),'active_seconds':round(active,1),'started':state.get('started'),'finished':state.get('finished'),'failure':state.get('failure'),'raw_result':str(p.relative_to(BASE))})
    stamp=datetime.now(timezone.utc).isoformat()
    payload={'updated':stamp,'observations':observations,'limitations':'All attempts retained. Input/output are reported separately from cache reads/writes; absent counters unknown. Active calls are partial. First whole-plan implementation/validation costs are separate from later completion loops. One trial, runner repairs and service interruptions prevent causal efficiency claims. No incomplete game counts as a saving.'}
    out=BASE/'maintenance';out.mkdir(exist_ok=True)
    (out/'combined.json').write_text(json.dumps(payload,indent=2)+'\n')
    fields=['cohort','id','machine','phase','task','attempt','started','finished','status',*KEYS]
    with (out/'combined-calls.csv').open('w') as f:
        writer=csv.DictWriter(f,fields,extrasaction='ignore');writer.writeheader();writer.writerows(rows)
    def cell(s):return '<td>'+html.escape(str(s))+'</td>'
    (BASE/'results.md').write_text('# Tetris 007 combined observations\n\n'+payload['limitations']+'\n\n'+progress_text()+'\n\nSee results.html and maintenance/combined.json for all retained trials, timing, recovery and usage coverage.\n')
    table=''
    for o in observations:
        u=o['usage'];metrics=[f"{u[k]['reported']:,} ({u[k]['coverage']}/{u[k]['calls']})" for k in KEYS]
        table+='<tr>'+''.join(map(cell,[o['cohort'],o['id'],o['status'],f"{o['tasks']}/13",*metrics,o['calls'],len(o['resumes']),round(o['active_seconds']/60,1)]))+'</tr>'
    progress=(out/'results.md').read_text() if (out/'results.md').exists() else 'Acceptance review remains pending.'
    page='<html lang="en"><meta charset="utf-8"><title>Tetris 007 combined ledger</title><style>body{font:15px system-ui;margin:2rem}td,th{padding:.5rem;border:1px solid #ccc;text-align:left}table{border-collapse:collapse}pre{white-space:pre-wrap}</style><h1>Tetris 007 · E00–E04 combined observations</h1><p>Updated '+stamp+'</p><p>'+html.escape(payload['limitations'])+'</p><p><a href="maintenance/latest.json">Latest timer check</a> · <a href="maintenance/progress.json">Progress</a> · <a href="maintenance/combined.json">Per-phase, first-call costs and recovery JSON</a> · <a href="maintenance/combined-calls.csv">Per-call usage CSV</a></p><pre>'+html.escape(progress)+'</pre><div style="overflow:auto"><table><tr>'+''.join('<th>'+s+'</th>' for s in ['Cohort','Trial','Status','Tasks','Input (coverage)','Output (coverage)','Cache read (coverage)','Cache write (coverage)','Calls','Resumes','Active min'])+'</tr>'+table+'</table></div></html>'
    temp=BASE/'combined.tmp';temp.write_text(page);temp.replace(BASE/'results.html')
    one=ROOT/'docs/tetris-007-experiments-one-pager.html';text=one.read_text()
    text=re.sub(r'<!-- maintenance-summary -->[\s\S]*?<!-- /maintenance-summary -->','',text)
    for code in ['E00','E01','E02','E03','E04']:
        group=[o for o in observations if o['experiment']==code]
        latest=max(group,key=lambda o:o.get('started') or '') if group else None
        if latest:
            label=f"{latest['tasks']}/13 · {latest['status']}"
            text=re.sub(r'(<tr data-experiment="'+code+r'"[\s\S]*?<span class="badge">)[^<]*(</span>)',lambda m:m[1]+html.escape(label)+m[2],text,count=1)
    text=text.replace('</main>','<!-- maintenance-summary --><aside class="callout"><strong>Maintenance '+stamp+':</strong> E00/E01/E03 finished 13 tasks; acceptance scope review pending. E02 recovery preserves the genuine reachable-fixture rejection and malformed-output history. E04 receipt repair is running; old loop remains stopped. No efficiency verdict yet. <a href="experiments/tetris-007/results.html">Combined ledger and local check-ins</a>.</aside><!-- /maintenance-summary -->\n</main>')
    one.write_text(text)
if __name__=='__main__':refresh()
