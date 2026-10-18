#!/usr/bin/env python3
"""Protocol-v2 evaluation. Preserve catalogue, validate completion + receipt chain.
Interactive palette is measured in PTY; complete seven-piece coverage/reachable
fixtures require independent validator evidence review rather than test counts.
"""
import importlib.util,json,re,subprocess,sys
from pathlib import Path
spec=importlib.util.spec_from_file_location('check',Path(__file__).with_name('check-product.py'));check=importlib.util.module_from_spec(spec);spec.loader.exec_module(check)
def verify(target,plan):
    result=check.verify(target,plan);checks=result['checks'];plan=Path(plan);target=Path(target)
    state=json.loads(plan.with_name('batch-state.json').read_text())
    contract=json.loads(re.search(r'```batch-plan\s*\n([\s\S]*?)\n```',plan.read_text())[1])
    ids=[t['id'] for t in contract['tasks']]
    checks['tasks_complete']={'passed':set(state['done'])==set(ids) and len(state['done'])==len(ids) and state['active'] is None,'done':state['done'],'task_count':len(ids)}
    checks['commit_receipts']={'passed':bool(state['commits']) and all(subprocess.run(['git','-C',str(target),'cat-file','-e',c['commit']+'^{commit}'],capture_output=True).returncode==0 for c in state['commits'])}
    original=(Path(__file__).resolve().parents[2]/'docs/experiments/tetris-007/inputs/plan.md').read_text()
    clauses=[l.strip() for l in original.splitlines() if l.strip().startswith('- ') and not re.match(r'^\s*- \[[ xX]\]',l)]
    checks['catalogue_preserved']={'passed':all(l in plan.read_text() for l in clauses),'missing':[l for l in clauses if l not in plan.read_text()]}
    text=checks['actual_npm_start_pty'].get('output_tail','');colours=set()
    for sgr in re.findall(r'\x1b\[([0-9;]+)m',text):
        parts=sgr.split(';')
        for i,p in enumerate(parts):
            if p in [str(x) for x in list(range(30,38))+list(range(90,98))]:colours.add(p)
            elif p=='38' and i+2<len(parts):colours.add(';'.join(parts[i:i+(5 if parts[i+1]=='2' else 3)]))
    checks['retro_palette']={'passed':len(colours)>=3,'scope':'Actual PTY launch; seven-piece palette coverage requires independent validator evidence review.','distinct_colours':len(colours)}
    result['passed']=all(c['passed'] for c in checks.values());result['protocol']='v2 matched E05/E06; plain non-TTY allowed, interactive colours required; no retroactive change to original trials.';return result
if __name__=='__main__':
    try:r=verify(sys.argv[1],sys.argv[2])
    except Exception as e:r={'passed':False,'error':str(e)}
    print(json.dumps(r,indent=2));raise SystemExit(0 if r['passed'] else 1)
