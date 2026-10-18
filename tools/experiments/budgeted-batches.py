"""E07 builds on reviewed batches and replaces the four-task split heuristic."""
from pathlib import Path
import importlib.util,json
BUDGET={'version':1,'limits':{'implementation_minutes':30,'validation_minutes':15,'input_output_tokens':180000,'context_tokens':80000},'context_reserve':.25}
OLD='''When a proposed batch has >4 remaining tasks,
it may select the largest reviewed prefix of <=4; otherwise it preserves the
reviewed group. No active batch changes during retry/resume. This is a declared
conservative split heuristic, not learned optimisation. There is no model call before each batch.'''
NEW='''The resource selector considers the whole remaining reviewed group first,
then approved prefix splits in descending size. There is NO task-count cap.
Every task MUST include an estimate object with positive numeric fields:
implementation_minutes, validation_minutes, input_output_tokens, context_tokens.
Estimates cover implementation AND verification for that task, not number of
files or task headings. Input/output excludes separate cache counters; context
is estimated required working context, not cumulative cache reads. Shared
context may be conservatively attributed across tasks; explain assumptions.
The selector sums estimates and selects the largest approved prefix fitting ALL
limits: 30 implementation minutes, 15 validation minutes, 180000 input/output
tokens and 60000 context tokens (80000 limit with 25% correction reserve).
These are initial experiment heuristics, not proven capacities. Three reviewers
must assess estimate plausibility, large cohesive defaults and smaller fallback
boundaries. Propose sufficiently fine independently testable split points to
handle underestimated work; an atomic task that cannot fit requires replanning.
After accepted batches, ordinary code calibrates time/token estimates using the
last three complete observations (actual/estimated ratio bounded 0.5–4). Missing
usage is unknown and does not calibrate. Context occupancy is not measured by
ACP, so its estimate remains conservative and uncalibrated. No active batch
changes during retry/resume. No per-batch model selection call is added.'''

def configure(target:Path):
    spec=importlib.util.spec_from_file_location('reviewed',Path(__file__).with_name('reviewed-batches.py'));v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v);v.configure(target,whole=False)
    machines=target/'.assembly-lines/.machines'
    for name in ['plan_author','plan_reviewer_opus','plan_reviewer_gemini','plan_reviewer_astra','plan_synthesiser']:
        p=machines/name/'AGENTS.md';s=p.read_text()
        if OLD not in s:raise ValueError('Reviewed policy changed; refusing partial adaptation')
        s=s.replace(OLD,NEW)
        s+='\nE07: Prefer large cohesive default batches, potentially the whole plan when it fits. Review smaller safe fallback boundaries. Include estimates in the JSON tasks; do not change the seed, acceptance catalogue, models, or dependencies to meet a budget.\n'
        p.write_text(s)
    for name in ['doer','validator']:
        p=machines/name/'AGENTS.md';p.write_text(p.read_text()+'''\nE07: batch-state.active.budget records predicted resource usage and actual
selection limits. The batch scope is fixed. Use concise output and focused
orientation, but never skip acceptance checks to fit estimates. If the selected
work cannot be completed within its resource envelope, report the concrete
blocker and preserved work; do not claim partial completion or edit batch state.
The supervisor can stop overruns without committing or completing partial work.
A reviewed fallback can be activated only by an explicit recovery intervention
with independent validation, never silently mid-attempt.
''')
    (target/'.assembly-lines/batch-budget.json').write_text(json.dumps(BUDGET,indent=2)+'\n')
