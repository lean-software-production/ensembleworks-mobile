# Tetris 007 experiment execution

Four isolated configuration branches/worktrees under `/workspaces/tetris-007-experiments/E00` through `E03`, three fresh target/run pairs per configuration. The supervisor runs the configurations concurrently and each configuration's trials sequentially. E00 is telemetry-only control; E01 compresses doer operational instructions; E02 removes Pi's duplicate raw system attachment while preserving the rendered user instructions; E03 replaces only the bookkeeping planner with a deterministic ACP machine.

`inputs/plan.md` comes from the tracked 006 plan at `tetris-007-before-run`, with completion markers reset, before any 007 author revision. `inputs/seed.md` makes the retro-colour request explicit. `inputs/acceptance.md` freezes evaluation criteria. The original line/config/instructions are archived under `inputs/assembly-lines/`. Every trial receives these same bytes; variant machine/config changes live only in its target. No completed 007 product is copied into experimental targets. Existing historical targets remain available in each checkout but agents are instructed to work only in their fresh target.

Author, planner and synthesiser effective default thinking was probed as medium and is explicitly pinned to medium. Doer uses Sol low; validator Sol high; reviewers Opus 5.5, Gemini 4 Argon, GPT-6 Astra high. Existing isolated credentials are copied into ignored per-trial machine directories; credentials and model sessions are never archived in results.

`manifest.json` records worktrees, commits and input hashes. Each trial gets an annotated `tetris-007-e00-r1-before-run` style tag immediately before launch. Factory product commits stay on their experiment branch. One branch/worktree per configuration safely supports sequential fresh trials; four daemons can run concurrently. Model dependencies are installed once and shared read-only via a node_modules symlink. Each daemon uses its worktree's bridge from PATH.

Launch/monitor:

```sh
python3 tools/experiments/supervise.py
cat docs/experiments/tetris-007/results/E00.json
/workspaces/tetris-007-experiments/E00/bin/factory watch tetris-007-e00-r1
```

The supervisor is started as a detached process so terminal disconnects do not abandon the pilot. Its log and PID are in `results/`. Results are updated atomically every five seconds. Do not start a second supervisor over existing trials. Each factory failure remains a failed observation; the supervisor proceeds to a fresh trial without steering or automatic resume. A three-hour per-trial ceiling stops and records a hung run. No changes are made to measured configurations once they start.

Each trial archives ignored factory records, final plan, review state/history and verification alongside an input snapshot, branch/result commit, timing and usage summary. Cache reports include coverage counts: absent fields are unknown, never inferred zero. Input+output and cache categories must be reported separately; model/provider token conventions do not establish a monetary cost. Local machines have known zero input/output and may have unknown cache fields.

`tools/experiments/check-product.py` independently runs the final suite, checks task completion, non-TTY row bounds and retro palette, then launches actual npm start in a PTY and checks quit/termios restoration after input. This smoke check does not prove every gameplay action; frozen task acceptance and independent validators supply additional evidence. Documentation presence is checked automatically; completeness and validator evidence require review before a final quality verdict. All failures stay in the denominator. Summarise three trials with median and range; report acceptance separately. Parallel provider contention can distort latency.
