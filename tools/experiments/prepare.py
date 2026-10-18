#!/usr/bin/env python3
"""Prepare isolated targets after applying the shared packet commit to worktrees."""
import argparse, hashlib, json, os, shutil, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
BASE=Path('/workspaces/tetris-007-experiments')
PACKET=ROOT/'docs/experiments/tetris-007/inputs'
parser=argparse.ArgumentParser();parser.add_argument('--worktrees',default=str(BASE));parser.add_argument('--first-trial',type=int,default=1);parser.add_argument('--trials',type=int,default=3);parser.add_argument('--configs',nargs='+',choices=['E00','E01','E02','E03','E04','E05','E06','E07'],default=['E00','E01','E02','E03']);parser.add_argument('--cohort',default='');args=parser.parse_args()
BASE=Path(args.worktrees).resolve()
if args.first_trial<1 or args.trials<1:parser.error('Positive trial numbers/count required')
if args.cohort and not __import__('re').fullmatch(r'[a-zA-Z0-9-]+',args.cohort):parser.error('Invalid cohort')
manifest={'protocol':f'{args.trials} fresh trial(s)/configuration; no steering or automatic resume','input_hashes':{str(p.relative_to(PACKET)):hashlib.sha256(p.read_bytes()).hexdigest() for p in PACKET.rglob('*') if p.is_file()},'experiments':[]}
for code in dict.fromkeys(args.configs):
    w=BASE/code
    if not (w/'docs/experiments/tetris-007/inputs').exists():raise RuntimeError(f'Apply shared packet commit in {w} first')
    profiles={}
    for trial in range(args.first_trial,args.first_trial+args.trials):
        name=f'tetris-007-{code.lower()}-r{trial}';target=w/'tetris'/name;run=w/'factory/runs'/name
        if target.exists() or run.exists():raise RuntimeError(f'Refuse to overwrite {name}')
        shutil.copytree(PACKET/'assembly-lines',target/'.assembly-lines')
        for machine in (target/'.assembly-lines/.machines').iterdir():
            config=machine/'machine.json'
            if not config.exists():continue
            cfg=json.loads(config.read_text())
            if cfg.get('model')=='openai-codex/gpt-6.1-sol':cfg['model']+=':medium'
            if code=='E03' and machine.name=='planner':
                cfg={'role':'planner','harness':str(w/'tools/experiment-local-planner.cjs')}
            config.write_text(json.dumps(cfg,indent=2)+'\n')
            if code=='E01' and machine.name=='doer':shutil.copy2(w/'tools/experiments/compact-doer.md',machine/'AGENTS.md')
            if cfg.get('harness')=='pi':
                source=ROOT/'tetris/tetris-007/.assembly-lines/.machines'/machine.name/'auth.json'
                if not source.is_file():raise RuntimeError(f'Missing machine login: {machine.name}')
                shutil.copy2(source,machine/'auth.json');os.chmod(machine/'auth.json',0o600)
            profiles[machine.name]=cfg
        if code=='E04':
            import importlib.util
            spec=importlib.util.spec_from_file_location('whole_plan',Path(__file__).with_name('whole-plan.py'));variant=importlib.util.module_from_spec(spec);spec.loader.exec_module(variant);variant.configure(target)
        if code in ['E05','E06','E07']:
            import importlib.util,re
            module='budgeted-batches.py' if code=='E07' else 'reviewed-batches.py'
            spec=importlib.util.spec_from_file_location('batch_variant',Path(__file__).with_name(module));variant=importlib.util.module_from_spec(spec);spec.loader.exec_module(variant)
            if code=='E07':variant.configure(target)
            else:variant.configure(target,whole=code=='E06')
        profiles={m.parent.name:json.loads(m.read_text()) for m in (target/'.assembly-lines/.machines').glob('*/machine.json')}
        run.mkdir(parents=True)
        if code in ['E05','E06','E07']:
            source=(PACKET/'plan.md').read_text()
            catalogue=re.sub(r'(?m)^- \[ \] (\d+)\. (.+)$',lambda m:'### R'+m[1].zfill(2)+'. '+m[2],source)
            catalogue=catalogue.replace('Every task below must produce a focused committable change in the target, including the automated checks described. Tasks remain unchecked until their changes have been committed.','R01–R13 below are the frozen acceptance catalogue, not execution tasks. The author proposes tasks and reviewed batch gates covering every clause. Bookkeeping records execution progress separately.')
            (run/'plan.md').write_text(catalogue+'\n## Proposed execution plan\n\nThe plan author must propose executable tasks, reviewed batches and the batch-plan JSON block before review.\n')
            packet=w/'docs/experiments/tetris-007/cohorts'/args.cohort/'inputs';packet.mkdir(parents=True,exist_ok=True)
            shutil.copy2(PACKET/'plan.md',packet/'original-acceptance.md')
            (packet/'plan.md').write_text((run/'plan.md').read_text())
            (packet/'seed.md').write_text((PACKET/'seed.md').read_text()+'\nFor this matched cohort, plain non-TTY output is permitted. Retro colours are checked in the interactive terminal and all seven tetromino render cases. Production lifecycle integration fixtures must be reachable through legal gameplay, without direct edits to settled-board or active-piece state to force game over.\n')
        else:shutil.copy2(PACKET/'plan.md',run/'plan.md')
        subprocess.run([str(w/'bin/factory'),'--check-line','--target',str(target),'--line','efficient'],cwd=w,check=True)
    subprocess.run(['git','-C',str(w),'add','--',*[f'tetris/tetris-007-{code.lower()}-r{i}' for i in range(args.first_trial,args.first_trial+args.trials)]],check=True)
    subprocess.run(['git','-C',str(w),'commit','-m',f'Prepare {code} {args.cohort or "pilot"} fresh measured targets with frozen profiles'],check=True)
    manifest['experiments'].append({'id':code,'worktree':str(w),'branch':subprocess.check_output(['git','-C',str(w),'branch','--show-current'],text=True).strip(),'config_commit':subprocess.check_output(['git','-C',str(w),'rev-parse','HEAD'],text=True).strip(),'profile':profiles})
manifest['pi_version']=subprocess.check_output(['pi','--version'],text=True).strip()
manifest['node_version']=subprocess.check_output(['node','--version'],text=True).strip()
output=ROOT/'docs/experiments/tetris-007'
if args.cohort:output=output/'cohorts'/args.cohort
output.mkdir(parents=True,exist_ok=True)
(output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
