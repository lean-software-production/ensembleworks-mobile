# Tetris 008: was the cheaper code equally good?

**No clear equivalence. One-shot was cheapest; Ralph was more defensive and easier to inspect in this post-run review.** Batches sat between them structurally, but had a different mix of defects. None was defect-free. This is a review of these three outputs, not proof that an assembly-line policy causes better code.

The original “accepted” statuses describe the original acceptance checks. The audit below is additional evidence. All three original suites still pass, and all pass the same added core-model/render checks and 1,500 legal input/timer actions covering all seven piece types and three restarts. Additional shared probes expose terminal and lifecycle gaps that the original validators missed.

## Structure and readability

| | Ralph | One-shot | Logical batches |
| --- | --- | --- | --- |
| Production source | 380 lines / 5 files | 168 lines / 5 files | 233 lines / 4 files |
| Original suite | 53 tests pass | 14 tests pass, plus its PTY script | 19 tests pass |
| Responsibility boundaries | Model, render, decoder, scheduler and terminal composition separate | Model/render/input separate; dense session owns scheduling and terminal I/O | Model/render separate; session owns decoder, scheduling and terminal I/O |
| Readability | Most explicit names, contracts and comments | Most compressed statements and control flow | Intermediate; model is clearly separated, session has several jobs |
| Importing production entry | No startup side effects | Starts a game and writes a frame | Starts a game and writes a frame |
| Documented minimum terminal | 63×24 | 52×24 | 40×24 |
| Gravity interval | 1 second | 1 second | 0.5 second |

Line and test counts are **not quality scores**. One-shot contains parameterized assertions and a substantial production-entry/PTY test despite having fewer named tests. Ralph’s extra code includes explicit source validation, immutable shape definitions, a separately owned scheduler and a cancellation-generation guard. Batches also freezes shape definitions; one-shot leaves the exported definitions mutable. The narrower display in batches is a practical advantage, not a correctness failure in the wider versions.

## Identical post-run probes

✓ passed the stated probe; ✗ reproduced a gap. Rows are different behaviours, not equally weighted points. There is no overall percentage score.

| Shared check | Ralph | One-shot | Batches |
| --- | :---: | :---: | :---: |
| All-seven-piece rotation cycles, wall/floor rejection and pure bounded rendering | ✓ | ✓ | ✓ |
| Stable 0–4 row clearing, ordering, dimensions and independent rows | ✓ | ✓ | ✓ |
| 1,500 legal inputs/ticks: state invariants, seven types, restart, ≤1 timer | ✓ | ✓ | ✓ |
| Ordinary Q / Ctrl-C in a real PTY | ✓ | ✓ | ✓ |
| Ctrl-C after Escape in a real PTY | ✗ | ✗ | ✓ |
| Ignore an OSC control string containing `q`, in a real PTY | ✓ | ✗ | ✗ |
| Ignore ESC-intermediate sequences such as `ESC ( q` | ✓ | ✗ | ✓ |
| Preserve pre-existing raw-mode flag (injected terminal) | ✓ | ✗ | ✓ |
| Cleanup on input EOF (injected stream) | ✓ | ✓ | ✗ |
| Ignore a canceled gravity callback invoked after quit (injected clock) | ✓ | ✗ | ✗ |
| Preserve unrelated listeners during cleanup | ✓ | ✓ | ✓ |
| Import entry point without output/startup | ✓ | ✗ | ✗ |
| Handle delayed real Writable error after quit without crashing | ✗ | ✗ | ✗ |

## Reproduced findings

1. **Ralph and one-shot can swallow Ctrl-C after Escape.** Launch the game, send Escape, then Ctrl-C without Enter. Both remain running; batches exits normally. Ralph handles Ctrl-C only in the plain decoder state; one-shot consumes it as an unsupported Escape suffix. [Ralph decoder](../../../tetris/tetris-008-ralph/src/input.js), [one-shot decoder](../../../tetris/tetris-008-one-shot/src/input.js).
2. **One-shot and batches can interpret control-string payloads as commands.** Send the bytes `ESC ] 0 ; q BEL`. Both unexpectedly quit. Ralph consumes the string and remains running. One-shot also treats the final `q` in `ESC ( q` as quit; Ralph and batches consume that unsupported sequence. [Batches decoder](../../../tetris/tetris-008-implement-in-batches/src/session.js).
3. **All three detach the output error handler too early.** A real Node Writable whose pending write fails asynchronously after immediate quit emits an unhandled error, terminating the isolated child process. This is common to all three, so it does not distinguish the lines. The normal synchronous-throw/fake-emitter tests did not cover it. [Ralph cleanup](../../../tetris/tetris-008-ralph/src/main.js), [one-shot cleanup](../../../tetris/tetris-008-one-shot/src/session.js), [batches cleanup](../../../tetris/tetris-008-implement-in-batches/src/session.js).
4. **One-shot loses prior raw-mode state in the adapter probe.** It always calls `setRawMode(false)` during cleanup. Ralph and batches restore the saved flag. This tests reuse inside an already-raw session; ordinary fresh-launch PTY restoration passed for all three.
5. **Batches has no input-end cleanup hook.** Emitting EOF on the injected interactive input leaves the gravity timer running and raw mode enabled. Ralph and one-shot tear down. Actual PTY disconnect behaviour may also involve SIGHUP; this probe specifically tests input-end ownership.
6. **Canceled callback resilience differs.** Invoking a captured canceled gravity callback after quit mutates the one-shot and batches game states; batches also redraws. Ralph rejects it using a disposed/generation check. This is an adversarial injected-scheduler check, not evidence that native Node timers normally execute a canceled callback.
7. **One-shot and batches have import-time startup side effects.** Importing `src/main.js` without a TTY writes a frame (575 and 565 bytes respectively); Ralph’s direct-execution guard makes import safe. This complicates reuse and testing even though normal CLI startup works.

## What this means for the efficiency story

The defensible statement is **“one-shot used fewer reported tokens to pass the original acceptance checks.”** We have not established equal robustness or equal maintainability. Ralph has more defensive code and passes more of these selected boundary probes; batches handles the pending-Escape interrupt correctly where Ralph does not. No single output dominates every dimension.

The next useful improvement is a **shared, frozen quality gate** covering these reproduced behaviours for every line. Keep this audit separate from the original cost dataset, preserve the measured products, and use a new explicitly labelled repair observation or fresh cohort if we want to compare cost to reach that stronger quality bar. A single post-hoc review cannot establish that single-task execution is intrinsically safer, or that whole-plan execution intrinsically sacrifices quality.

## Evidence and reproduction

- [Source fingerprints and measured-commit verification](quality/manifest.json)
- [Shared probe results and failure evidence](quality/shared-probes.json)
- [Actual production PTY results](quality/production-pty.json)
- Original suite reruns: [Ralph](quality/ralph-suite.log), [one-shot](quality/one-shot-suite.log), [batches](quality/batches-suite.log)

From the repository root:

```sh
node tools/experiments/tetris-008-quality.mjs
python3 tools/experiments/tetris-008-quality-pty.py
```

The probes return JSON observations, including failures, rather than rewriting implementation files. Their process exit code is not an overall product-quality verdict. Model, renderer, decoder and production session adapters use the same boundary cases across variants; full-entry PTY probes use `node src/main.js` directly, matching the command behind `npm start`. Probe selection followed source inspection: this is a post-hoc audit, not a blinded or pre-registered quality benchmark. Production source hashes match the final measured commits. No model calls or product changes were made during this audit.
