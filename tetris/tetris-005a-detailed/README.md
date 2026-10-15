# Terminal Tetris

## Scoring

Line-clear points are awarded once when a piece locks: 1 line = 100, 2 = 300,
3 = 500, and 4 = 800. There are no level, speed, or drop-point bonuses.

## Project notes


A fresh target using the same seed, careful assembly line, models, doer and
validator as `tetris-005a`. Only the planner's instructions change: it creates
small, independently verifiable tasks with acceptance checks and tests alongside
each behavior. Distinct game rules become separate tasks rather than one broad
implementation task.

The original run used three broad tasks. Compare that plan with the new one at
`factory/runs/tetris-005a-detailed/plan.md` after starting this run. Expect smaller
commits and more implementation/validation cycles; this can mean more agent calls.
The planner still preserves existing plans and marks work done only after commits.

## Run from the repository root

Check the assembly line without calling agents:

```sh
bin/factory --check-line --target tetris/tetris-005a-detailed --line careful
```

Start the new build (calls real agents):

```sh
bin/factory --run tetris-005a-detailed --target tetris/tetris-005a-detailed --line careful --seed tetris/spec.md
```

Resume with:

```sh
bin/factory --run tetris-005a-detailed
```

Each machine uses its own configuration folder. Available login files were
copied locally from the corresponding original machines and remain ignored by
Git. If needed, refresh each machine's Pi login:

```sh
for machine in planner doer validator; do
  cp "$HOME/.pi/agent/auth.json" \
    "tetris/tetris-005a-detailed/.assembly-lines/.machines/$machine/auth.json"
done
```

Once the game has been generated:

```sh
npm --prefix tetris/tetris-005a-detailed start
```
