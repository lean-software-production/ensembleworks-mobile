#!/usr/bin/env python3
"""Record labelled acceptance re-evaluation without replacing original outcomes."""
import concurrent.futures, importlib.util, json, re, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];BASE=ROOT/'docs/experiments/tetris-007'
spec=importlib.util.spec_from_file_location('checker',Path(__file__).with_name('check-product.py'));checker=importlib.util.module_from_spec(spec);spec.loader.exec_module(checker)
PALETTE=r'''
import {pathToFileURL} from 'node:url';
const {renderFrame}=await import(pathToFileURL(process.argv[1]+'/src/render.js'));
const styles={};
for(const type of 'IJLOSTZ'){
 const board=Array.from({length:20},()=>Array(10).fill(null));board[10][4]=type;
 const frame=renderFrame({board,score:0,status:'running',active:null,color:true},{color:true,isTTY:true,env:{}});
 const row=frame.split('\n')[11];
 const m=row.match(new RegExp('\\x1b\\[([0-9;]+)m(?: ?'+type+' ?|\\[\\])'));
 styles[type]=m?.[1]??null;
}
console.log(JSON.stringify({styles,passed:Object.values(styles).every(Boolean)&&new Set(Object.values(styles)).size===7}));
'''
def task_sections(text):
    return {m[1]:m[2] for m in re.finditer(r'^- \[[ xX]\] (\d+)\.([^\n]*\n[\s\S]*?)(?=^- \[[ xX]\] \d+\.|\Z)',text,re.M)}
def check(code):
    name=f'tetris-007-{code.lower()}-r'+('2' if code=='E04' else '5')
    w=Path('/workspaces/tetris-007-experiments')/('whole-plan-receipt' if code=='E04' else 'contract-01')/code
    t=w/'tetris'/name;r=w/'factory/runs'/name
    result=checker.verify(t,r/'plan.md')
    probe=PALETTE if code!='E04' else PALETTE.replace('const {renderFrame}', 'const {render:renderFrame}').replace('{board,score:0,status:\'running\',active:null,color:true},{color:true,isTTY:true,env:{}}', '{board,score:0,over:false,paused:false,active:null},true')
    palette=subprocess.run(['node','--input-type=module','-e',probe,str(t)],text=True,capture_output=True,timeout=20)
    result['label']='20261017 maintenance re-evaluation; original acceptance.json retained'
    result['seven_piece_render_palette']=json.loads(palette.stdout) if palette.returncode==0 else {'passed':False,'error':palette.stderr}
    frozen=task_sections((BASE/'inputs/plan.md').read_text());actual=task_sections((r/'plan.md').read_text())
    result['clause_audit']={i:{'heading_preserved':body.splitlines()[0]==actual.get(i,'').split('\n')[0], 'original_clauses_missing_verbatim':[line.strip() for line in body.splitlines()[1:] if line.strip().startswith('- ') and line.strip() not in actual.get(i,'')]} for i,body in frozen.items()}
    result['interpretation']='Non-TTY palette failure conflicts with accepted plain non-TTY design; render palette and PTY evidence evaluated separately. Frozen acceptance explicitly requests non-TTY colours: this scope discrepancy remains recorded, not silently waived. Clause wording changes require semantic review. No final acceptance granted by this re-evaluation.'
    out=BASE/'maintenance'/f'{code}-acceptance-reevaluation.json';out.write_text(json.dumps(result,indent=2)+'\n')
    print(code,'checks', {k:v['passed'] for k,v in result['checks'].items()},'palette',result['seven_piece_render_palette'],'drift', {k:v for k,v in result['clause_audit'].items() if not v['heading_preserved'] or v['original_clauses_missing_verbatim']},flush=True)
if __name__=='__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(check,['E00','E01','E02','E03','E04']))
