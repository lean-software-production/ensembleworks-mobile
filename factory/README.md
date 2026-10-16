# Factory — iteration 006

Start a named run from the repository root, giving it a target, one of that
target's assembly lines, and a seed:

```sh
bin/factory --run tetris --target tetris/tetris-003 --line careful --seed tetris/spec.md
bin/factory watch tetris
npm --prefix tetris/tetris-003 start
```

The run remembers all three in `factory/runs/tetris/run.json`. After that its
name is enough, and it carries on from its plan:

```sh
bin/factory --run tetris
```

Naming a run again with its original settings is fine. Naming it with a
different target, line or seed is refused: start another run instead. Relative
seed and target paths are relative to the caller's working directory. The
factory creates missing target folders and initializes Git only when no
repository contains the target.

Each run keeps its plan in `factory/runs/<name>/plan.md`, never in the target.
`/factory/runs/` is ignored by Git. To resume a game built before runs existed,
move its `.factory/plan.md` to `factory/runs/<name>/plan.md` before starting the
run.

## Lines live in the target

A target holds its product and, in `.assembly-lines/`, the lines that build it:
`<name>.dot` each. [tetris-003](../tetris/tetris-003/.assembly-lines) has two:

- `careful`: planner, doer, then validator; retry the doer when `satisfied` is
  false and return to the planner when it is true.
- `quick`: the same line without the validator, so work goes unchecked.

Both start with the planner and finish when its `complete` result is true.
Labels name boolean fields in machine results. `not complete`, for example,
routes when `complete` is false. A single unlabelled edge always routes. The factory asks
machines for the fields on their outgoing edges; it does not hardcode their names.

## Fan out and join

Several unlabelled edges from one machine run all their branches concurrently.
Each branch must have exactly one unlabelled edge to the same joining machine.
The factory checks this before calling any machine. For example, replace the
validator in a copy of `careful.dot` with:

```dot
doer -> reviewer_1
doer -> reviewer_2
doer -> reviewer_3
reviewer_1 -> synthesiser
reviewer_2 -> synthesiser
reviewer_3 -> synthesiser
synthesiser -> doer    [label="not satisfied"]
synthesiser -> planner [label="satisfied"]
```

Create a `machine.json` for each new name. Reviewers use `"role": "reviewer"`
and a chosen `lens` or `lensFile`. Set each reviewer's `model` to its Pi
`provider/model` identifier, using three different providers for the course's
three big brains. Each receives the same current-work diff; matching lenses and
instructions produce identical prompts. Different branch instructions work too.
The synthesiser uses `"role": "synthesiser"` and can select its own model.

Every branch is asked for a JSON result, even though its edge has no label.
The joining machine receives only the reports, keyed by branch name, and its
configured instructions. Its decision routes the line; its `findings` go back
to the doer on a retry. A failed branch stops sibling harness processes and
prevents synthesis and commits.

Demo these behaviors with external doubles, from `factory/`:

```sh
npm test -- --name 'Reviewers that wait for each other|The synthesiser rejects|A failed report'
```

A line never names a target, so copying `.assembly-lines/` into another target
gives that target the same lines and machines. Validate a line without
contacting agents:

```sh
bin/factory --check-line --target tetris/tetris-003 --line careful
```

## Configure machines

Each named node has its own directory at
`.assembly-lines/.machines/<name>/` in the target. Write its instructions in
`AGENTS.md` and select its harness and model in `machine.json`:

```json
{"role": "doer", "harness": "pi", "model": "anthropic/your-model"}
```

Omitting `harness` selects Pi. All role instructions and review lenses now live
in the machine's `AGENTS.md`; the factory has no built-in role prompts. Existing
Tetris machines and the plan-first fixture have been migrated. Edit their
`AGENTS.md` to change behavior; `lens`, `lensFile` and `prompt` in `machine.json`
are no longer used.

The factory speaks [ACP v1](https://agentclientprotocol.com/protocol/v1/initialization)
over each machine's stdin/stdout. `pi`, `claude`, and `codex` harness names
resolve to `pi-rpc-acp`, `claude-agent-acp`, and `codex-acp`; the ACP executable
names can also be used directly. Install the adapters on PATH. The Pi bridge
is included in `tools/pi-rpc-acp/` and is on the devcontainer's PATH.

Pi runs with `PI_CODING_AGENT_DIR` set to the machine folder,
`--no-context-files`, and `--append-system-prompt <folder>/AGENTS.md`.
Claude Code uses `CLAUDE_CONFIG_DIR`, `settingSources: ["user"]` in ACP
`session/new`, and a generated `CLAUDE.md` importing `AGENTS.md`.
Codex uses `CODEX_HOME` and `project_doc_max_bytes = 0` in its local
`config.toml`. Models come from `machine.json`: Pi receives `--model`, Claude
receives the model through session options, and Codex's local config gets it.
Use each adapter's native model identifier. Each runs in the target,
which is its work rather than its configuration. Antigravity is unsupported.

Copy the harness's login into each machine folder: `auth.json` for Pi/Codex,
or `.credentials.json` for Claude Code. With no login, supply the provider's
API key in the environment (for example `ANTHROPIC_API_KEY` for Claude/Pi,
`CODEX_API_KEY` for Codex, or `OPENROUTER_API_KEY` for Pi's OpenRouter models).
Pi infers the provider from its `provider/model` model setting, defaulting to
Anthropic when none is given. All machines are checked before any is called;
a missing login and API key stops the run. A copied login takes precedence.
The factory adds local ignore rules for credentials and harness runtime files.
Existing tracked credentials must be removed from Git before using a machine.

Ordinary executable machines speak ACP too, without agent authentication.
A custom executable wrapping an agent can select `"adapter": "pi"`, `"claude"`,
or `"codex"` for its configuration environment and credential checks.
Prompts travel as ACP text blocks on stdin, so changed-work diffs do not consume
argument space. Git and generated machine text are limited to 10 MiB per call.

## Watching, steering, and stopping

Starting a run returns immediately. One daemon per factory stays up between runs
and allows one run at a time; a second start is refused while a run is active.
`bin/factory status` reports whether the daemon is up and the active run's name.

```sh
bin/factory watch tetris   # replay the record, then follow until the run ends
bin/factory say tetris doer "use curses, not print"
bin/factory stop tetris    # interrupt active machines; keep the daemon up
bin/factory --run tetris   # resume using the remembered settings and plan
bin/factory stop          # interrupt the active run and shut down the daemon
```

`say <run> <machine> <message>` sends guidance to that machine's current attempt
through ACP's `_session/steering`. During parallel work, name the specific
reviewer, such as `reviewer_2`. Delivery requires the adapter to acknowledge
injection; an inactive machine or an adapter that cannot steer is refused.
Messages are not carried into retries or other machines. Put lasting guidance
in the seed, plan, or machine instructions.

`factory/runs/<name>/record.jsonl` keeps generated text, machine states, usage,
delivered steering messages, and run outcomes. Watching works after the run and
daemon finish too. Lines identify their machine; token totals accumulate per
machine, provider, and run.
Providers come from `machine.json`'s `provider` or Pi's `provider/model` name;
Claude and Codex default to Anthropic and OpenAI. Usage comes from the ACP
prompt response. Totals are tokens, not currency estimates.

Stop waits for the active process groups to exit. It leaves unfinished work in
the target, commits no interrupted attempt, and leaves its task unfinished.
The daemon uses a private Unix socket in the system temp folder; the socket's
name is derived from the factory path. Run state remains in the factory's runs.

The factory supplies run data after the machine's instructions. Optional
`{{seed}}`, `{{plan}}`, `{{target}}`, `{{work}}`, `{{findings}}`, `{{reports}}`,
`{{task}}`, `{{review}}`, `{{accepted}}`, `{{name}}` and `{{committed}}` placeholders
place that data inline. `{{#committed}}...{{/committed}}` selects instructions
following a work commit, and `{{^committed}}...{{/committed}}` selects the initial
invocation. Inserted run data is never expanded as a template. Joining machines
receive only branch results, without target, seed, plan or changed-work context.

## Work, retries, and history

`--attempts 3` is the default limit per task. Rejected findings go to the doer,
which records and resolves them as subtasks. Exhausting the limit leaves the work
uncommitted and the parent task unfinished. Invalid results, failed machines,
failed commits, and tasks with no committable work stop the run too.
Every planned task needs a committable deliverable. For verification-only tasks,
the doer writes or updates `VERIFICATION.md` in the target with the checks it
actually performed, commands, outcomes, and any unperformed checks or limitations.
An accepted report can then be committed before the planner marks the task done.

On the route back to a planner, the factory commits the task's work before
asking the planner to mark it done. Commits include only the run's target,
without its `.assembly-lines/` or the run's plan, preserving unrelated staged and
unstaged changes. The factory never reads the plan's contents.

Do not rebase or switch branches while a factory run is active: both operations
share the repository's Git index.

## Plan-first assembly lines

The `plan-first` line reviews a comprehensive plan before implementing any task.
Its configuration is preserved in the [test fixture](features/fixtures/plan-first/.assembly-lines/).
Copy that `.assembly-lines/` directory into a target to use it:

```sh
bin/factory --check-line --target path/to/target --line plan-first
bin/factory --run plan-first-demo --target path/to/target --line plan-first --seed tetris/spec.md
```

The `plan_author` defines responsibilities, collaboration contracts, behavior
examples, meaningful tests and committable tasks. Four `plan_reviewer` machines
fan out over gameplay/scope, object design, testability and terminal experience.
Their `plan_synthesiser` decides; it may override an objection with a recorded
reason. Every reviewer finding needs a disposition before implementation starts.
Later reviews focus on revisions and their consequences for other contracts.

The `planner` tracks completion; the doer chooses coding details within accepted
contracts. A single `plan_validator` returns exactly one of `satisfied`, `retry`
or `replan`. Implementation defects retry the doer. Plan defects return to the
author and reviewers, keeping the current task unfinished and work uncommitted.
For plan-first lines, accepting a revised plan never commits rejected work;
successful implementation validation permits the commit before progress tracking.

`--plan-rounds 3` limits each planning episode (initial planning or a plan repair).
The round count survives restarts; exhaustion stops before another author call.
`--attempts 3` independently limits doer attempts per task within an invocation;
repairing a plan does not reset that count. Model or branch failures also consume
the planning round already started. Limits count calls, not tokens or cost.

The run saves `plan-review.json` beside `plan.md`, with reports, changes,
acceptance dispositions and repair evidence. Per-round history lives in
`plan-reviews/episode-<n>-round-<n>.json`. These files stay outside product commits.
The factory stores machine results and never reads the plan's contents. A small
local `plan_gate` harness checks the acceptance checkpoint without a model call,
so resuming an accepted plan proceeds directly to progress tracking. Amend design
through the author/review route; completion and retry notes can change without
reopening accepted contracts.

Resume with `bin/factory --run plan-first-demo`. The full run contacts the
configured Pi models and generates the target. Automated tests use external
doubles and exercise the real checkpoint gate, including rejection limits,
overrides and safe plan repair.

## Checks

From `factory/`:

```sh
npm ci
npm test
npm run typecheck
```

The default suite excludes `@real-agent`, uses external machine doubles, and
invokes the public launcher through a symlink in isolated workspaces. Passing it
verifies routing and orchestration, not real generated code or OO-design verdicts.
Real-agent course examples remain manual checks: the existing runner does not
define all their observation steps. This iteration's reviewer example asks you
to check that the reports discuss testability. Use Pi with the configured
providers to exercise a real line; `pi --offline --list-models` shows the models
currently available locally.
