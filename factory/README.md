# Factory — iteration 004

Start a named run from the repository root, giving it a target, one of that
target's assembly lines, and a seed:

```sh
bin/factory --run tetris --target tetris/tetris-003 --line careful --seed tetris/spec.md
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
routes when `complete` is false. Unlabelled edges always route. The factory asks
machines for the fields on their outgoing edges; it does not hardcode their names.

A line never names a target, so copying `.assembly-lines/` into another target
gives that target the same lines and machines. Validate a line without
contacting agents:

```sh
bin/factory --check-line --target tetris/tetris-003 --line careful
```

## Configure machines

Each named node has `.assembly-lines/.machines/<name>/machine.json` in the
target. A machine's name is unique in its target: every line there that names
the doer runs the same doer. Set `harness` to a command or executable path;
omitting it selects `pi`. The command receives `-p` and runs in the target, with
the full UTF-8 prompt supplied on stdin and stdin closed when input is complete.
Custom harnesses must support this input contract. Prompts, including the
validator's complete changed-work diff, do not consume command-line argument space.
Git and machine output buffers are limited to 10 MiB per invocation.
`role` selects the machine's responsibility; optional `prompt` adds instructions.

The validator's `lensFile` is relative to its configuration file. In tetris-003
it points to `lens.md` beside it, the OO-design lens influenced by Metz,
Wirfs-Brock, West, Beck, Cunningham, and Smalltalk. A `lens` string in its
configuration overrides the file, for example `"lens": "testability"`.

## Work, retries, and history

`--attempts 3` is the default limit per task. Rejected findings go to the doer,
which records and resolves them as subtasks. Exhausting the limit leaves the work
uncommitted and the parent task unfinished. Invalid results, failed machines,
failed commits, and tasks with no committable work stop the run too.

On the route back to a planner, the factory commits the task's work before
asking the planner to mark it done. Commits include only the run's target,
without its `.assembly-lines/` or the run's plan, preserving unrelated staged and
unstaged changes. The factory never reads the plan's contents.

Do not rebase or switch branches while a factory run is active: both operations
share the repository's Git index.

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
