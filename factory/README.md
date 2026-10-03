# Factory — iteration 003

Run the assembly line from the repository root:

```sh
bin/factory --seed tetris/spec.md --target tetris/tetris-003
npm --prefix tetris/tetris-003 start
```

The line now runs to completion. There is no one-pass mode or `--all` flag.
Each target has its own `.factory/plan.md`; selecting an existing target resumes
its plan. Relative seed and target paths are relative to the caller's working
directory. The factory creates missing target folders and initializes Git only
when no repository contains the target.

## Change the route

Edit [assembly-line.dot](assembly-line.dot). The default route is:

- Start with the planner; finish when its `complete` result is true.
- Otherwise call the doer, then the validator.
- Retry the doer when `satisfied` is false; return to the planner when it is true.

Labels name boolean fields in machine results. `not complete`, for example,
routes when `complete` is false. Unlabelled edges always route. The factory asks
machines for the fields on their outgoing edges; it does not hardcode their names.

To run unchecked, remove the validator's edges and replace `doer -> validator`
with `doer -> planner`. No code change is needed. Validate the line without
contacting agents:

```sh
bin/factory --check-line
```

## Configure machines

Each named node has `<name>/machine.json` beside the line. The default machines
are [planner](planner/machine.json), [doer](doer/machine.json), and
[validator](validator/machine.json). Set `harness` to a command or executable path;
omitting it selects `pi`. The command receives `-p` and runs in the target, with
the full UTF-8 prompt supplied on stdin and stdin closed when input is complete.
Custom harnesses must support this input contract. Prompts, including the
validator's complete changed-work diff, do not consume command-line argument space.
Git and machine output buffers are limited to 10 MiB per invocation.
`role` selects the machine's responsibility; optional `prompt` adds instructions.

The validator's `lensFile` is relative to its configuration file. It points to
[the OO-design lens](validation-lens.md), influenced by Metz, Wirfs-Brock, West,
Beck, Cunningham, and Smalltalk. A `lens` string in its configuration overrides
the file, for example `"lens": "testability"`.

## Work, retries, and history

`--attempts 3` is the default limit per task. Rejected findings go to the doer,
which records and resolves them as subtasks. Exhausting the limit leaves the work
uncommitted and the parent task unfinished. Invalid results, failed machines,
failed commits, and tasks with no committable work stop the run too.

On the route back to a planner, the factory commits the task's work and current
plan before asking the planner to mark it done. Before finishing, it records any
remaining plan update in a plan-only commit. Plan-only commits are not new tasks.
Commits include only the selected target, preserving unrelated staged and unstaged
changes. The factory never reads the plan's contents.

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
