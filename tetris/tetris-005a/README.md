# Tetris 005a scaffold

This target starts with configuration only. The factory will build the terminal
Tetris game from `tetris/spec.md` here when you start the run.

The `careful` line plans, implements one task, then validates it through a
**testability** lens. Rejected work returns to the doer with findings; accepted
work is committed before the planner marks the task done. The run finishes when
the planner reports that its plan is complete.

Each machine has its own harness configuration directory under
`.assembly-lines/.machines/`, containing:

- `AGENTS.md`: its role instructions, with run-data placeholders filled by the factory.
- `machine.json`: its harness and model, using the same Pi model choices as the existing targets.
- `.gitignore`: keeps credentials, caches and sessions out of Git.

Edit only the validator's `AGENTS.md` to change the review lens. Edit a machine's
`machine.json` to change its model or harness. Pi is configured for all three;
Claude Code and Codex require their own model identifiers and login files.
The factory isolates each harness's configuration from your personal settings
and instruction files in or above the target.

## Prepare authentication

No logins are included in this scaffold. With your Pi login already available,
copy it separately into each machine folder, from the repository root:

```sh
for machine in planner doer validator; do
  cp "$HOME/.pi/agent/auth.json" "tetris/tetris-005a/.assembly-lines/.machines/$machine/auth.json"
done
```

Alternatively, configure each machine with an API-key-backed provider/model and
set that provider's key in your environment. The selected `openai-codex` models
normally use a copied Pi login. A missing login and API key stops the run before
any machine is called. A copied login may need refreshing later.

## Check and build

From the repository root, validate the line without contacting an agent:

```sh
bin/factory --check-line --target tetris/tetris-005a --line careful
```

After preparing authentication, start the build:

```sh
bin/factory --run tetris-005a --target tetris/tetris-005a --line careful --seed tetris/spec.md
```

The plan and run settings live in `factory/runs/tetris-005a/`. Resume with:

```sh
bin/factory --run tetris-005a
```

After the build, start the generated game with `npm --prefix tetris/tetris-005a start`.
The build commands above contact real agents; scaffolding does not run them.
