# Tetris 008: execution granularity

Three new sequential observations in the current checkout, with separate product folders and factory run IDs:

1. `tetris-008-ralph`: line `implement-reviewed-ralph`, 13 singleton units.
2. `tetris-008-one-shot`: line `implement-reviewed-one-shot`, one unit containing the complete plan.
3. `tetris-008-implement-in-batches`: line `implement-reviewed-batches`, the author/planner proposes logical contiguous groups; three reviewers assess grouping before implementation. Groups execute whole, with no four-task cap or resource adaptation.

All use the same frozen T01–T13 task definitions, R01–R13 acceptance, seed, initial empty product state, models, instruction-delivery wrapper, strict result contracts, commit receipts and deterministic dispatch. Each independently clarifies the starting plan and gets Opus 5.5, Gemini 4 Argon and GPT-6 Astra at high. Doer: GPT-6.1 Sol low; validator: GPT-6.1 Sol high; author and synthesis: Sol medium. No task decomposition changes, features, steering or acceptance waivers. Batches are reviewed before implementation; doer retries keep their original unit fixed.

The three task groupings deliberately create different numbers of validation gates and accepted commits. A five-attempt limit applies per unit, so Ralph has more possible total attempts than one-shot; all trials share a 90-minute ceiling. Planning has five rounds per episode. Independent planning can still produce different collaboration contracts; this compares the complete line configurations, not a perfectly isolated causal estimate of grouping alone.

`dataset.json` is the new, separate dataset. The presentation page is `docs/tetris-008-efficiency-one-pager.html`, generated from `one-pager.template.html`. Old 007 observations remain untouched. Count every reported call, including unsuccessful attempts; present complete accepted work for efficiency comparisons and keep failures visibly labelled. No automatic fresh retries or silent recovery. Missing usage/cache counters remain unknown; phase and coverage metrics live in JSON. Cache reads and I/O stay separate. One trial each cannot establish repeatability. Fixed sequential order and shared provider caches are remaining confounders; a later replication should counterbalance order.

Commands from repository root:

```sh
python3 tools/experiments/tetris-008.py prepare  # once; refuses existing targets/results
python3 tools/experiments/tetris-008.py start    # detached sequential coordinator
python3 tools/experiments/tetris-008.py status  # refresh dataset + one-pager
```

`run` runs the coordinator in the foreground. The coordinator holds a file lock, confirms the shared factory daemon is idle before each trial, waits for terminal factory status, performs external acceptance and archives evidence before starting the next target. A failed trial stays failed; it does not prevent the next configuration from receiving its first trial. A restarted coordinator can attach to the same live factory worker, retaining its original trial deadline. An absent worker requires inspection and is never restarted automatically; do not invoke a separate factory run concurrently. Keep this workspace alive while running.

Factory commits only product paths in each target, excluding `.assembly-lines`, so unrelated working-tree changes remain untouched. The coordinator creates no branches or worktrees. Machine-local login files are copied only to ignored auth paths with mode 0600 and never enter the dataset. Setup validates all three graphs without inference. Manifest hashes identify shared inputs and runner sources; initial plans and per-target configuration are preserved before inference.

Accepted means the factory's independent validators accepted every unit and the external protocol-v2 checker passed. PTY smoke is not a complete gameplay oracle: preserved validator evidence and legal production lifecycle tests supply the remaining coverage. Keep quality claims separate from test counts. Review the archived acceptance JSON, plan review and validator reports before using a result in a presentation.

## Explicit Ralph continuation

After batches completed, the user requested finishing the original interrupted Ralph observation. `python3 tools/experiments/tetris-008.py resume-ralph` archives the stopped result, plan and record, preserves accepted task IDs and uncommitted T10 work, then resumes through the same line. The original interrupted result and missing call usage remain recorded; no replacement trial is created. Five attempts apply to the new invocation. The cumulative 90-minute clock includes both invocation spans, including the original stall, and excludes the gap between them. Presentation run minutes use that clock; `wall_elapsed_seconds` and `segments` preserve the full timing context. This is a labelled resumed observation with a lower-bound token total, not an uninterrupted comparison.

The final presentation page uses the embedded Tetris 006 sketchbook theme and inline SVG assembly-line, phase-cost, cache-read and validation-gate diagrams. `status` regenerates it from the dataset using `tools/experiments/tetris-008-visuals.py`; desktop, mobile and A4 print layouts are included.

A subsequent [code-quality audit](quality-review.md) reruns original suites and applies shared model, decoder, lifecycle and real-PTY probes. It found different robustness gaps despite all original acceptance passes. Audit evidence and source hashes live in `quality/`; the measured products and original acceptance statuses are preserved.
