"""E05/E06 combined improvements; authored task decomposition and reviewed batches."""
from pathlib import Path
import json
POLICY='''
This experiment uses reviewed execution tasks rather than the old 13 parent
checkboxes. The plan's R01–R13 catalogue is frozen product acceptance: preserve
every original clause. Propose your OWN executable tasks and dependencies;
map every requirement to one or more tasks. Do not weaken scope or redefine
requirements to fit batch size. Each task needs observable acceptance checks.

Include exactly ONE fenced block labelled batch-plan containing strict JSON:
{"version":1,"tasks":[{"id":"T01","title":"...","requirements":["R01"],"acceptance":["..."]}],"batches":[{"id":"B01","title":"...","task_ids":["T01"],"depends_on":[],"reason":"cohesive independently testable deliverable","split_after":[]}]}
Use T-number task IDs and B-number batch IDs. Include ALL proposed tasks exactly
once across ordered batches. Each depends_on lists only earlier batch IDs.
All R01–R13 must be covered. Task IDs listed in split_after must be members
other than the last task; those are the ONLY permitted ordinary-code split points.
Describe execution order and collaboration contracts without repeating the full
acceptance catalogue. Complete each batch into a committable verified product.

The ordinary planner validates the schema, selects the next batch, and writes
batch-state.json beside plan.md. When a proposed batch has >4 remaining tasks,
it may select the largest reviewed prefix of <=4; otherwise it preserves the
reviewed group. No active batch changes during retry/resume. This is a declared
conservative split heuristic, not learned optimisation. There is no model call before each batch. Product defects retry
the doer; plan defects return to author/review. Preserve the JSON block after
acceptance (including repair of unrelated prose); a changed batch contract is
refused rather than silently invalidating completed work.

A factory commit_receipt proves actual validator acceptance and commit. Historical
doer prose saying validation/commit was pending is not current workflow state.
Only ordinary bookkeeping marks execution task IDs complete in batch-state.json.
Do not edit batch-state.json or mark requirements/tasks complete yourself.
'''

def configure(target:Path,whole=False):
    machines=target/'.assembly-lines/.machines'
    for name in ['plan_author','plan_reviewer_opus','plan_reviewer_gemini','plan_reviewer_astra','plan_synthesiser']:
        p=machines/name/'AGENTS.md';s=p.read_text()
        s=s.replace('Preserve all task identities, acceptance checks and completion states.','Preserve all R01–R13 acceptance clauses and existing completion state. Propose executable tasks and batch boundaries.')
        s=s.replace('On the first round, prepare the existing 13-task plan for implementation review.','On the first round, propose execution tasks and batches for the R01–R13 acceptance catalogue.')
        s=s.replace('Read the seed and plan. Edit only the plan;','Read the seed and plan. Edit only the plan;')
        s=s.replace('Check the 13-task\nsequence has committable increments','Check the proposed execution-task and batch\nsequence has committable increments')
        s+=POLICY
        s+='\nCOMPARISON POLICY: '+('Use EXACTLY ONE batch containing ALL proposed task IDs; split_after MUST be empty. Review the full-product acceptance gate.' if whole else 'Propose cohesive default batches and safe split points. Prefer testable boundaries to an arbitrary task count. Consider shared code, dependency closure, terminal lifecycle ownership, verification cost, and expected correction scope. Explain each batch rationale.')+'\n'
        p.write_text(s)
    (machines/'doer/AGENTS.md').write_text('''You are the doer. Read Run context target, seed, plan and findings. Work only
in target; never commit. Read batch-state.json beside the supplied plan. Its
active work_item and task_ids are the exact fixed work scope. Read plan globals,
contracts, selected tasks and ALL mapped R01–R13 clauses; open other tasks only
for dependencies. Implement the ENTIRE selected batch, not just its first task.
Preserve previous batches. Inspect Git status and recover verified interrupted
work. Resolve validator findings within the same selected batch. Never edit the
accepted task/batch JSON or batch-state.json. Report evidenced plan defects.
Read/update HANDOFF.md (<250 words) with source/test locations, factual choices,
verification recipes and remaining work. Never copy steering or transcripts.
Run focused checks during editing and the full suite after final code changes.
Preserve all edge cases, 24-row frames, seven-piece retro palette, reachable
integration fixtures, and actual npm start PTY/quit/termios checks when relevant.
Keep non-TTY output bounded/readable; plain output is permitted. Final batch
must demonstrate fall -> lock -> clear/score -> game-over -> restart -> quit
through production composition with fixtures reachable by legal gameplay.
VERIFICATION.md maps completed requirement IDs to actual check evidence.
Give brief progress; no tool narration. Finish with exactly ONE standalone JSON
object on its own final line: task = exact active.work_item, task_ids = active.task_ids
in exact order, checks = concise performed verification, limitations = honest
remaining concerns. Validation and commit occur after this report; do not claim
they have already happened. Do not append another JSON acknowledgement.
''')
    (machines/'validator/AGENTS.md').write_text('''You are the validator. Read Run context target, seed, plan, task (historical
doer JSON), work (diff) and accepted. Read active batch-state.json beside plan;
require exact task identity/task_ids and check all selected execution tasks,
mapped R01–R13 acceptance clauses, reviewed contracts and dependency boundaries.
Never edit files, progress or Git. Independently inspect relevant changes and
run checks; doer claims and HANDOFF are navigation, not proof. Preserve every
original acceptance clause. Do not demand unrelated future batches. On final
batch, run the full suite and verify production reachable-fixture lifecycle,
seven-piece palette, actual npm start PTY input/quit and exact terminal restore.
All frames <=24 rows; non-TTY may be plain. Judge boundary cases not test count.
Retry concrete product/verification defects; replan only evidenced contract
contradictions; keep the selected batch fixed through retries. Never add scope.
Finish with exactly one standalone final JSON object: satisfied, retry, replan
(booleans, exactly one true), findings (empty iff satisfied), checks. Failures
need actionable file/section evidence/remedy. No code fence, attached prose or
second JSON object. The factory commits only satisfied work, then supplies its
receipt to deterministic bookkeeping. Do not require a doer to approve itself.
''')
    p=machines/'planner/machine.json';p.write_text(json.dumps({'role':'planner','harness':str(target.parents[1]/'tools/experiments/batch-planner.cjs')},indent=2)+'\n')
    for config in machines.glob('*/machine.json'):
        cfg=json.loads(config.read_text())
        if cfg.get('harness')=='pi':
            cfg.update(harness=str(target.parents[1]/'tools/experiments/pi-once.cjs'),adapter='pi')
            config.write_text(json.dumps(cfg,indent=2)+'\n')
    (machines/'planner/AGENTS.md').write_text('You are the planner. Ordinary ACP code reads Run context plan, target, committed and commit_receipt; selects reviewed batches and records accepted tasks.\n')
