# Tetris 006 — Codex GPT-6 Luna

This setup starts from the pre-generation checkpoint
`demo-tetris-006-free-2026-10-15`. The existing target and run name
`tetris-006-free` are retained; all three machines now use
`openai-codex/gpt-6-luna` through Pi and the bundled `pi-rpc-acp` bridge.
Pi uses its saved `openai-codex` authentication.

## Assembly line

`start -> planner -> doer -> validator -> planner ... -> finish`

The planner creates and tracks the plan. The doer implements one task at a
time. The validator checks functional correctness against the seed and its
review criteria in `.machines/validator/lens.md`. Rejected work returns to the
doer with findings. Accepted work is committed before the planner marks it done.
The line finishes when the planner reports completion.

## Start from the repository root

```sh
bin/factory --run tetris-006-free --target tetris/tetris-006-free --line quick --seed tetris/spec.md
bin/factory watch tetris-006-free
```

The run settings are already saved locally, so starting by name also works:

```sh
bin/factory --run tetris-006-free
```

Stop the run with `bin/factory stop tetris-006-free`; restart by name to resume.
`bin/factory stop` shuts down the daemon. The plan and event history live in
`factory/runs/tetris-006-free/`, which is ignored by Git.

Once generation finishes, launch the game with:

```sh
npm --prefix tetris/tetris-006-free start
```

## Fresh demo worktree

The original free-model checkpoint tag remains unchanged. The Luna setup is on
`demo/tetris-006-codex-luna`. Use a separate worktree to start a demo without old
run history or generated game files:

```sh
git worktree add --detach ../ensembleworks-mobile-tetris-006-luna-demo demo/tetris-006-codex-luna
cd ../ensembleworks-mobile-tetris-006-luna-demo
npm --prefix factory ci
bin/factory --run tetris-006-free --target tetris/tetris-006-free --line quick --seed tetris/spec.md
bin/factory watch tetris-006-free
```

Model reference: https://developers.openai.com/api/docs/models/gpt-6-luna
