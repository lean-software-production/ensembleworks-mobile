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

## Launch observations

At the initial four-way cold start, E00/r1 and E03/r1 hit the existing factory daemon startup timeout before any machine/model call. Their daemons became ready afterwards and the supervisor started fresh r2 inputs, as the protocol requires. These zero-call infrastructure failures remain in the trial denominator and reduce the number of completed-game observations; they are not evidence about instruction efficiency. The measured runner is unchanged. Further trials are not silently substituted.

The first successful author calls confirm cache-read counters reach records and the ledger (including explicit cache-write zero). Full factory regression suites run concurrently have reported failures; exact diagnostics are being collected. Live records and the ledger remain the source of truth.

E02/r1 then failed at the first plan review: Opus emitted a valid findings object followed by a second standalone metadata JSON object without findings. The existing runner takes the last JSON object and rejected it. This is a measured protocol/output failure, distinct from the zero-call startup failures; usage and full reviewer output are archived. E02/r2 starts fresh, with no configuration repair.

## Halted pilot — no efficiency verdict

All 12 trial slots have observations: two zero-call startup failures, two E02 plan-review output/schema failures, seven factory failures ending with model stop reason `error`, and one explicit operator stop (E02/r3). No game completed and no task was committed. Supporting Codex agents explicitly reported an account usage limit at the same time as the model errors. The bridge retained factory stop reasons but not the providers' detailed error messages, so the factory errors' exact cause remains unverified.

The supervisor was terminated and the remaining active factory run stopped to avoid further model work. All original inputs, records, plans/reviews and partial products are archived under `results/<trial>/`; credentials are excluded. Experiment branches/worktrees remain intact. The ledger is an incident dataset, not an efficiency comparison. Resuming needs a newly identified cohort after service capacity is available, with daemon preflight and provider-error circuit breaking before new measurement. Do not overwrite or resume these observations as if they were fresh trials.

## Restart-01: one fresh trial per configuration

After the user reported the usage reset, four fresh `r4` targets were prepared on the existing isolated experiment branches/worktrees. Earlier target/run state and the halted pilot archives remain intact. Exactly one trial per configuration is scheduled; no automatic retries or extra trials. Model/thinking profiles and variant differences are unchanged. Shared pre-author plan, seed and acceptance input hashes are unchanged.

All four daemons are started and confirmed idle before measurement, avoiding simultaneous cold-start timeouts. The CLI uses TypeScript transpilation without type checking; daemon execution already used that mode in the first pilot. Two configurations ending with provider error stop reasons trigger a supervisor circuit breaker, stopping remaining active runs and preserving observations. This shared operational safeguard does not repair model output or change machine instructions.

Cohort manifest and observations live in `cohorts/restart-01/`. The main HTML ledger shows this cohort, while the previous pilot remains under `results/` and tag `tetris-007-experiments-halted`. One observation per configuration supports an exploratory comparison, not a reliable estimate of variance or median savings.

```sh
python3 tools/experiments/supervise.py --cohort restart-01 --first-trial 4 --trials 1
```

Do not invoke that command a second time over existing observations. The detached supervisor continues after the chat turn and updates the ledger every 30 seconds.
