# Tetris 007: a smaller-context steering experiment

The `tetris-007` run is prepared with a fresh target at `tetris/tetris-007`, the
`efficient` line, and the same `tetris/spec.md` seed as 006. No agents have run
and no game implementation has been copied. Start it when you have terminals
ready for watching and steering.

See the [assembly-line diagram](tetris-007-one-pager.html#assembly-heading) for
the parallel plan review, acceptance checkpoint, implementation retries and
plan-repair route.

## What changes from 006

The [006 analysis](tetris-006-one-pager.html) is the baseline. Its record contains
399,747 input/output tokens: planner 85,789 across 16 calls, doer 313,958 across
15 calls. Two doer calls failed to produce readable results; both runs resumed.
The report could not assign an exact token cost to repeated reading or separate
useful work from recovery overhead.

The run starts with a local plan checkpoint. If the plan has not been accepted,
a plan author prepares its contracts and three independent reviewers fan out in
parallel over the same revision. A synthesiser reconciles their reports and
either accepts the plan or sends required revisions back to the author.

After acceptance, the route is planner → doer → validator. A satisfied validator
returns to the planner; an implementation defect sends concrete findings back
to the doer for the same task. A concrete plan defect returns to the author and
the three plan reviewers. The factory commits only after implementation validation
succeeds, before the planner marks that task done; accepting a repaired plan never
commits rejected work. The default limit is three doer attempts per task within
an invocation; exhausting it leaves unfinished work uncommitted. Plan repair does
not reset the implementation attempt count.

The planner retains its 006 Pi model, `openai-codex/gpt-6.1-sol`. The doer uses
`openai-codex/gpt-6.1-sol:low`, replacing 006's GPT-5.6 Terra. The validator uses
`openai-codex/gpt-6.1-sol:high`, with a focused testability and correctness lens. It
reads the current task, changed work and relevant dependencies, runs relevant
checks, and reports concise actionable findings without editing files. It returns
exactly one of `satisfied`, `retry`, or `replan` as true.

Validation raises the execution minimum from 27 to 40 model calls for 13 tasks.
One accepted planning round adds five model calls (author, three reviewers and
synthesiser), plus the local checkpoint: at least 46 machine calls, of which 45
use models, before retries or revisions. This adds independent quality checking,
so the total is no longer a comparison of instruction efficiency alone against
006's unvalidated quick line. Compare planner/doer usage separately and account
for plan review, validation, revisions and implementation retries.

The prepared plan is 006's complete 13-task plan with every checkbox reset.
Every original acceptance clause is preserved. The plan author can clarify
contracts and add examples required by review while keeping the 13 task
identities and existing checks. The prepared starting plan, added contracts and
their review costs must be considered in the comparison.

## Three big brains for the plan

| Machine | Pi model | Thinking |
| --- | --- | --- |
| `plan_reviewer_opus` | `openrouter/anthropic/claude-opus-5.5` | high |
| `plan_reviewer_gemini` | `openrouter/google/gemini-4-argon` | high |
| `plan_reviewer_astra` | `openai-codex/gpt-6-astra` | high |

Each reviewer's `machine.json` appends Pi's explicit `:high` selector to the
model. All three use identical review instructions covering gameplay, contracts,
testability and terminal experience. The first round reviews the whole plan;
subsequent rounds focus on changes, previous findings and affected dependencies.
They report stable finding IDs, evidence, severity and actionable recommendations.

`plan_author` and `plan_synthesiser` use `openai-codex/gpt-6.1-sol`. The synthesiser
must give an explicit disposition and reason for every finding from every
reviewer, including duplicates and overridden objections. Reports are advisory;
acceptance is not a majority vote. The synthesiser receives the reports alone.

The factory saves `plan-review.json` and per-round history under
`factory/runs/tetris-007/`. The local `plan_gate` reuses an accepted checkpoint
on resume instead of spending another review round. An unresolved planning
episode stops after three rounds by default; `--plan-rounds <n>` selects the
limit for an invocation and the saved round count prevents resuming from
bypassing it. A plan defect opens a new repair episode.

## Keeping context focused

The new machine instructions apply the report's proposed changes:

- Read global requirements, task headings, and the current task's complete
  acceptance criteria; open other task bodies only for dependencies.
- Keep a `HANDOFF.md` of at most 250 words with verified file locations,
  behavior choices, exact check recipes, pitfalls, and unresolved work.
- Recover and verify existing task changes after interruption.
- Run focused tests while editing and the full suite after final code changes;
  retain full failure diagnostics and rerun when edits invalidate evidence.
- Keep bounded frame capture separate from the actual `npm start` PTY check.
- Let the planner update only the exact committed task and scan remaining
  checkbox markers, without routinely reopening code or rerunning tests.
- Give short progress updates and concise standalone JSON results.

These instructions are longer than 006's doer instructions: the hypothesis is
that avoiding repeated orientation and verification discovery will save more
tokens than the extra instruction text costs. Savings have not been measured.
The bridge's existing message-boundary fix is retained. The runner still
duplicates some instruction/context data, and it still omits separate cache
counters; this experiment changes machine configuration, not the runner.

## Start, watch, and steer

From the repository root, start the run in one terminal:

```sh
bin/factory --run tetris-007 --target tetris/tetris-007 \
  --line efficient --seed tetris/spec.md
bin/factory watch tetris-007
```

In another terminal, when watching shows `doer running`, send guidance:

```sh
bin/factory say tetris-007 doer \
  "Check the current task's boundary cases and keep your successful test output concise."
```

For a visible product change, try this while the doer is working on rendering:

```sh
bin/factory say tetris-007 doer \
  "Use distinct ANSI colours for the tetrominoes, preserve readable plain output, and keep every frame within 24 rows."
```

The second example adds scope, so record it when comparing token totals.
While `validator running` is shown, you can also steer that review:

```sh
bin/factory say tetris-007 validator \
  "Check that the current task's tests exercise its boundary cases through controllable inputs."
```

During the parallel plan review, target one named reviewer, for example:

```sh
bin/factory say tetris-007 plan_reviewer_gemini \
  "Check the terminal lifecycle contracts include resize, interruption and cleanup."
```

That delivery goes only to `plan_reviewer_gemini`. Use `plan_reviewer_opus` or `plan_reviewer_astra` to
address the other reviewers while they are active. Plan-author and synthesis
calls are steerable too.

An acknowledged delivery belongs to the current machine call. Product changes
can persist, but future machines receive no automatic copy of the message.
The instructions explicitly prevent copying steering messages into handoff notes
as future requirements. Persistent intent belongs in the seed, plan or machine
instructions. The planner is also steerable while it runs, though its calls are
intended to be short. Naming an inactive machine is refused; watch before sending.

```sh
bin/factory stop tetris-007       # interrupt and retain unfinished files
bin/factory --run tetris-007      # resume the remembered run
bin/factory watch tetris-007      # replays delivered messages as well as output
```

After a successful build, launch the game with:

```sh
npm --prefix tetris/tetris-007 start
```

## Measure the result

```sh
python3 tools/compare-run-usage.py tetris-006 tetris-007
```

This reads saved usage, including failed/recovery calls, and shows machine totals,
call counts, completed tasks, run segments, and steering deliveries. While a run
is active, its current machine's usage has not arrived yet. A percentage is shown
only when both runs finish. Zero recorded usage is not proof of zero consumption.

Check all 13 completed tasks, task-specific edge cases, the full automated suite,
the final falling/locking/clear/score/game-over/restart/quit regression, bounded
frames, actual launch-command PTY smoke test, terminal cleanup, and the honest
verification report alongside token totals. Steering, fewer interruptions, the
pinned starting plan, plan review/revisions, added validation/retries, and
provider/model changes over time can affect the result. Opus and Gemini are
billed through OpenRouter; Astra uses the Codex provider. Token counts across
these providers do not establish monetary savings.
Lower totals alone do not establish equal quality, causal savings, or lower cost.

## Setup and portability

The Git tag `tetris-007-before-run` marks the committed configuration before the
first run. It preserves the line, machine instructions/models, diagram and
comparison tool. Returning to that tag restores tracked files; it does not reset
ignored runtime state. To discard an attempt later, stop the run first, archive
its `factory/runs/tetris-007/` folder, and recreate the unfinished plan using the
recipe below. Restore or archive generated target changes separately. Keep each
machine's ignored login so it remains ready for the next attempt.

Runtime files are ignored under `factory/runs/tetris-007/`: `run.json` remembers
absolute local settings, `plan.md` is the prepared plan, and `record.jsonl` will
be created when the run starts. Each machine has its own ignored login: planner
and doer were copied from the corresponding 006 machine, and validator uses a
separate copy of the planner's login for the same provider. The plan author,
synthesiser and Astra reviewer have their own Codex-provider login copies. The
Opus and Gemini reviewers each have an isolated copy of the existing local Pi
OpenRouter credential. The local checkpoint needs no login. Do not copy old
sessions or include logins in commits. Logins can still require refresh when a
real run starts.

The configuration and this guide can be committed normally. To recreate the
prepared plan in a fresh checkout, before starting this run:

```sh
python3 - <<'PY'
from pathlib import Path
import re
source = Path('factory/runs/tetris-006/plan.md').read_text()
plan = Path('factory/runs/tetris-007/plan.md')
plan.parent.mkdir(parents=True, exist_ok=True)
with plan.open('x') as output:
    output.write(re.sub(r'(?m)^(\s*- \[)[xX](\])', r'\1 \2', source))
PY
```

Supply each machine's login or the provider API key, then use the full start
command above to remember this checkout's paths. Never reset a started run's
plan; resume it or choose a new run/target name for another experiment.
