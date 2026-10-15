# tetris-006-free

A fresh terminal Tetris build from `tetris/spec.md` using the quick line:

`start -> planner -> doer -> validator -> planner ... -> finish`

The planner writes and tracks the plan; the doer implements each task. The
validator checks functional correctness and relevant tests against the seed.
Rejected work returns to the doer with findings; accepted work is committed
before the planner marks the task done. Each task allows three attempts by
default. The line finishes when the planner reports completion.

## Models

All three machines use Pi through the bundled `pi-rpc-acp` bridge, with fixed free
OpenRouter model IDs and no paid fallback configured:

- Planner: `openrouter/nvidia/nemotron-3-super-120b-a12b:free`
- Doer: `openrouter/cohere/north-mini-code:free`
- Validator: `openrouter/nvidia/nemotron-3-super-120b-a12b:free`

The validator's review criteria are in `.machines/validator/lens.md`.

Verified against the OpenRouter models API and the local Pi catalog on
2026-10-15: zero input/output token pricing and tool-call support. Free model
availability and limits can change. Pi uses the existing OpenRouter login.

- https://openrouter.ai/nvidia/nemotron-3-super-120b-a12b:free
- https://openrouter.ai/cohere/north-mini-code:free
- https://openrouter.ai/docs/guides/routing/model-variants/free

## Run from the repository root

The settings are saved in `factory/runs/tetris-006-free/run.json`.

```sh
bin/factory --run tetris-006-free
bin/factory watch tetris-006-free
```

The equivalent first-start command is:

```sh
bin/factory --run tetris-006-free --target tetris/tetris-006-free --line quick --seed tetris/spec.md
```

Interrupt with `bin/factory stop tetris-006-free`. Restart by name to resume.
`bin/factory stop` shuts down the daemon. The plan and event history live in
`factory/runs/tetris-006-free/`.

After generation finishes, start the game with:

```sh
npm --prefix tetris/tetris-006-free start
```

## Demo checkpoint

The `demo-tetris-006-free-2026-10-15` tag preserves the completed iteration 006
factory and this target's configuration before generation. The matching working
branch is `checkpoint/tetris-006-free-2026-10-15`.
Run history in `factory/runs/` is ignored by Git; switching branches does not
reset it or remove untracked generated game files.

For a fresh demo, create a separate worktree from the checkpoint. Its run history
starts empty, and any generated commits stay separate from the checkpoint branch:

```sh
git worktree add --detach ../ensembleworks-mobile-tetris-006-demo demo-tetris-006-free-2026-10-15
cd ../ensembleworks-mobile-tetris-006-demo
npm --prefix factory ci
bin/factory --run tetris-006-free --target tetris/tetris-006-free --line quick --seed tetris/spec.md
bin/factory watch tetris-006-free
```

The full start command recreates the ignored run settings with paths belonging
to the demo worktree. Use the tag to return to this starting configuration even
if later work advances the branch.
