"""E04: group implementation/validation into one whole-plan work item."""
from pathlib import Path

TASK = 'Implement the complete 13-task plan.'
EXECUTION = '''E04 execution policy: implement the entire accepted 13-task plan as one work item.
All 13 task identities, product requirements and acceptance clauses remain mandatory.
Task boundaries organise requirements; they are not separate factory commit gates
in this experiment. Clarify any per-task commit wording to this execution policy,
without removing checks. Plan review still precedes implementation. The validator
reviews the complete product before the factory makes one accepted-work commit.
The planner then marks all 13 tasks complete. Never request per-task commits or
stop after one task. This grouping is the only experimental change from control.
'''

def configure(target: Path):
    machines = target/'.assembly-lines/.machines'
    doer = machines/'doer/AGENTS.md'
    text = doer.read_text()
    replacements = {
        'Orient narrowly: read the seed, the plan\'s global requirements and completion\nrule, all task headings/checkboxes, and the FIRST unfinished task in full,\nincluding every acceptance clause and subtask. Read other task bodies only for\na dependency. Use targeted searches for relevant source/tests, not broad dumps.\nImplement only that task. Preserve all 13 boundaries and every acceptance check.':
        'Read the seed and the ENTIRE accepted plan, including all 13 task bodies,\ncontracts, dependencies, acceptance clauses and subtasks. Implement the complete\nplan in this call. Use targeted source/test searches. Preserve all 13 task\nidentities and every acceptance check; do not stop at a task boundary.',
        'Preserve the same\nunfinished task through retries and plan repair.':
        'Preserve the same\nwhole-plan work item through retries and plan repair.',
        'If findings exist, record them as subtasks of this task\nand resolve them; do not start another task.':
        'If findings exist, record them under the relevant plan sections\nand resolve them before whole-plan validation.',
        'Give a brief progress update on the current task and significant checkpoints so':
        'Give a brief progress update on implementation milestones and significant checkpoints so',
        'the EXACT task name in "task", concise':f'the fixed work-item name "{TASK}" in "task", concise',
        'current-task acceptance checks pass':'checks across all 13 tasks pass'
    }
    for before,after in replacements.items():
        if before not in text: raise ValueError('Control doer instructions changed: '+before[:55])
        text=text.replace(before,after)
    text+='\n'+EXECUTION+'''\nBefore reporting completion, run the final full suite and every required integration,
PTY launch, colour, frame-bound and cleanup check. In VERIFICATION.md map each of
13 exact task names to its checks and evidence. Report unresolved checks honestly.
Leave ALL parent task checkboxes unchecked; only the planner may mark them done
after whole-plan validation and the factory commit.
'''
    doer.write_text(text)
    validator=machines/'validator/AGENTS.md';text=validator.read_text()
    before='''Review the current task's changed work against the accepted plan's contracts,
responsibility ownership and complete acceptance criteria
and the seed's global requirements. Locate the exact task named by the doer;
read that task in full and the plan's global requirements. Open other task
bodies and surrounding code only for a relevant dependency or regression.
Do not re-review unrelated previously committed work or scan the whole project.'''
    if before not in text:raise ValueError('Control validator instructions changed')
    text=text.replace(before,'''Review the ENTIRE product against the complete accepted plan: all 13 task
bodies, requirements, contracts, edge cases and acceptance checks. The doer
reports one whole-plan work item, not an individual task heading. Inspect all
changed product code and tests, run the full suite and independently verify
integration and actual launch-command PTY checks. Check VERIFICATION.md's
per-task evidence against files; do not infer correctness from test count.''')
    validator.write_text(text+'\n'+EXECUTION)
    planner=machines/'planner/AGENTS.md'
    planner.write_text(f'''You are the planner for E04. Work only on the supplied plan; never implement
code or make Git commits. Preserve every requirement and all 13 task names.
Read Run context plan, committed (JSON-encoded historical doer report), and
commit_receipt (JSON-encoded factory confirmation of validation and commit).
With empty committed: scan all parent/subtask checkbox markers and report
complete only if none remain. Do not mark tasks done or inspect product code.
With committed: require exact work-item identity "{TASK}" in both
committed.task and commit_receipt.task. Require receipt.status="committed",
receipt.validation.satisfied=true and verify HEAD hash equals receipt.commit
and HEAD commit subject equals that work-item identity. This factory receipt
is the current authoritative completion state; the doer wrote its report BEFORE
independent validation and commit. Statements such as "validator review pending"
or "factory commit pending" in that older report are expected historical notes,
not blockers and not missing acceptance evidence. Do NOT require the doer to
claim its own independent approval or commit. Do NOT revalidate the product.
After matching the receipt, mark all 13 parent tasks and their completed subtasks
done, preserving all wording. Return complete=true when no checkbox remains.
If the receipt, identity or Git hash is missing/mismatched, stop with a clear
diagnostic; do not send accepted work back to the doer merely because its
historical report predates validation.
Never rewrite task names or remove acceptance checks. Do not rerun tests.
Finish with exactly one standalone JSON line: {{"complete":false}} or
{{"complete":true}}. True requires no unfinished task or subtask anywhere.
\n{EXECUTION}''')
    for name in ['plan_author','plan_reviewer_opus','plan_reviewer_gemini','plan_reviewer_astra','plan_synthesiser']:
        p=machines/name/'AGENTS.md';p.write_text(p.read_text()+'\n'+EXECUTION)
