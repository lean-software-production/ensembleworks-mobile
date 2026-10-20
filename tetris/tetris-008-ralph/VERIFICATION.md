# Verification

## Final R13 — B13 / T13 (supersedes historical pending notes below)

- `node --test test/lifecycle.test.js`: 2/2 passed. Imports the actual `src/main.js` entry point and invokes production `start` with controlled terminal streams, clock and fresh O source. One timed fall, pause/resume, legal horizontal/soft-drop placement of five O pieces clears two rows (300 points); centered legal stacking reaches blocked-spawn game over; r restarts and q restores raw mode/cursor and removes timers/input listener. No state edits force events. Every emitted game frame is exactly 24 rows, within 80 columns and without trailing newline. Second test checks every palette code through production terminal composition.
- `python3 tools/pty-smoke.py`: seven actual `npm start` PTY launches at 80×24 passed. Each displays its distinct ANSI piece colour (I 96, O 93, T 95, S 92, Z 91, J 94, L 33), accepts down/pause/resume/quit, exits 0 and restores exact before/after termios plus cursor. O launch additionally legally tiles two rows, observes Score: 300, stacks to Game over, restarts to Score: 0, then quits. Only Math.random is preloaded; no production state/rule changes. PTY verifies ANSI bytes, not human colour perception.
- Final `npm test` after final code changes: **53/53 passed**, zero failures. Local captured output: `.assembly-lines/b13-tests.log`. Includes actual bounded non-TTY npm launch, all R01–R12 regressions and new production lifecycle checks.
- Completed requirement evidence map: R01 `render.test.js`; R02 `model.test.js`; R03 `movement.test.js`; R04 `rotation.test.js`; R05 `descent.test.js`; R06 `locking.test.js`; R07 `clearing.test.js`; R08 `scoring.test.js`; R09 `game-over.test.js`; R10 `session.test.js`; R11 `input.test.js`; R12 `terminal.test.js`; R13 `lifecycle.test.js` and `tools/pty-smoke.py` (all test paths under `test/`). README documents launch, size, keys and rules.
- No observed plan defects or unresolved requirement failures. Linux PTY/Python smoke is separate from portable `npm test`; SIGKILL remains unhandleable. No commits or downstream validation performed. Historical batch entries below retain their original scoped evidence and counts.

## R01 — B01 / T01

- `npm test`: passed 2 tests, 0 failures after final code changes (Node v24.21.0, npm 11.19.0).
- `test/render.test.js`: verifies 10×20 empty cells, top/bottom borders, zero score, controls, deterministic pure rendering, exactly 24 rows counting untrimmed newlines, and no ANSI/carriage returns.
- Same suite launches literal `npm start` in the target via piped subprocess: exit 0, empty stderr, exact renderer output, no trailing newline and no extra npm banner rows.
- `npm start > /tmp/tetris-008-ralph-start.txt` followed by Node assertions: 24 rows, no trailing newline, bounded exit. Initial manual check exposed npm banner overhead; `.npmrc` resolves it and the literal-launch regression covers it.

## R02 — B02 / T02

- Focused `node --test test/model.test.js`: 2 passed, 0 failed.
- Final `npm test`: 4 passed, 0 failed. Preserves the R01 pure empty-frame regression and updates the literal `npm start` test for four visible active cells, plain bounded output and successful exit.
- `test/model.test.js`: all seven types have four distinct local cells; every initial spawn is centered and in bounds; settled board remains independent and empty; exactly one injected type is consumed; geometry copies do not mutate definitions.
- Controlled random values select all seven types in order. Seed 42 produces identical 100-piece sequences covering all seven; invalid random values and types reject explicitly.
- Each type renders four visible cells, both plain and ANSI-stripped frames occupy exactly 24 rows with 22-column board borders and no trailing newline. Tests verify distinct ANSI palette codes, per-cell resets and rendering purity.

## R03 — B03 / T03

- Focused `node --test test/movement.test.js`: 4 passed, 0 failed.
- Final `npm test`: 8 passed, 0 failed, including preserved model/render and actual non-TTY `npm start` checks.
- `test/movement.test.js` exercises all seven types: one-column left/right movement, overlap with the active piece's former cells (no self-collision), unchanged settled board, repeated movement to both walls, and exact state/reference preservation on rejection.
- Settled obstacles block both directions for every type. Shared `canPlace` additionally rejects top/floor bounds; invalid directions, paused/game-over states and absent active pieces cannot move.

## R04 — B04 / T04

- Focused `node --test test/rotation.test.js`: 4 passed, 0 failed.
- Final `npm test`: 12 passed, 0 failed, preserving all earlier checks including actual non-TTY `npm start` and 24-row/palette regressions.
- `test/rotation.test.js` verifies the exact clockwise fixed-square transform (4×4 I, 3×3 others), unchanged O, four distinct cells after every turn and complete four-turn restoration for all seven types. Shared definitions, origin, board and score remain unchanged.
- Enumerated legal placements in all non-square orientations exercise left/right wall and floor rejection. Settled-cell obstacles test every non-square orientation. Rejections preserve complete state and active reference; paused/game-over and missing-active cases reject safely.
- No kicks: `src/model.js` documents the transform and delegates placement to the existing shared predicate. Input wiring remains T11 scope.

## R05 — B05 / T05

- Focused `node --test test/descent.test.js`: 4 passed, 0 failed.
- Final `npm test`: 16 passed, 0 failed, including prior collision/rotation, seven-piece palette, 24-row rendering and actual bounded non-TTY `npm start` checks.
- `src/model.js` exports `moveDown(game)`: true for exactly one row of movement, false for blocked/unavailable play; uses shared `canPlace` and never locks or spawns.
- `test/descent.test.js` verifies exact one-row geometry for all seven types, unchanged board identity/content and score, and no additional source consumption. All four orientations of every type descend to the floor and stop; settled obstacles stop descent at the first obstruction. Repeated blocked calls preserve full state and active reference. Paused/game-over/missing-active guards are covered.

## R06 — B06 / T06

- Focused `node --test test/locking.test.js`: 5 passed, 0 failed.
- Final `npm test`: 21 passed, 0 failed, including all prior palette/frame/collision tests and literal bounded non-TTY `npm start`.
- `src/model.js`: `lockPiece` settles four cells and removes active geometry; `descend` moves OR locks/spawns once. Injected piece sources are retained in a WeakMap so renderer-facing state remains serializable. Use original `createGame` instances for progression (cloned snapshots are inspection data, not independent games).
- `test/locking.test.js`: all seven types settle exactly four cells without changing unrelated cells, board identity or score; separate locking consumes no piece and cannot repeat. Successful descent does not settle or consume. Floor and settled obstructions trigger one lock and one centered spawn at y=0; the following action moves that piece. Blocked spawn returns `{ kind: 'locked', spawnBlocked: true }`, leaves active null, preserves settled cells, and repeated attempts neither lock nor consume again. Unavailable/invalid states remain unchanged.
- Blocked-spawn status intentionally remains unresolved until T09; no overlapping active piece is rendered. No clear/score pipeline is claimed before T07/T08.

## R07 — B07 / T07

- Focused `node --test test/clearing.test.js test/locking.test.js`: 13 passed, 0 failed after final code changes.
- Final `npm test`: 29 passed, 0 failed, including literal non-TTY `npm start`, 24-row frame and seven-colour palette regressions.
- `src/model.js`: `clearLines(board)` returns the clear count, compacts in stable order, preserves board identity and inserts independent empty top rows. `descend` invokes it after locking and before consuming/placing the next piece; locked outcomes now include `cleared` (including zero).
- `test/clearing.test.js`: zero through four simultaneous clears, nonadjacent full rows, survivor order/content, empty top rows, independent row arrays, 10×20 dimensions and repeat compaction. Composed descent completes one and two rows; the injected source observes already-compacted state. A top-row completion opens the next spawn before collision checking. Score remains unchanged for T08.
- `test/locking.test.js` preserves all R06 checks with the extended zero-clear outcome.

## R08 — B08 / T08

- Focused `node --test test/scoring.test.js test/clearing.test.js`: 15 passed, 0 failed.
- Final `npm test`: 36 passed, 0 failed, including actual bounded non-TTY `npm start`, all seven palette codes and existing collision/frame regressions.
- `src/model.js`: frozen `LINE_POINTS` table `[0,100,300,500,800]`; `descend` applies one award after compaction and before next-piece selection/placement. `SCORING.md` documents the table, pipeline and number/display limits.
- `test/scoring.test.js`: composed locks clearing 0–4 rows verify exact awards, zero initialization, source-observed score ordering, no repeat award on following descent, live score rendering, accumulation over five locks, and unchanged score for non-locking descent, blocked descent, horizontal movement/rejection and rotation. Fixtures are focused model tests, not production lifecycle evidence.
- Large numeric and synthetic BigInt display values verify plain/ANSI-stripped frames remain exactly 24 rows without a trailing newline; score labels stay within 22 columns. Long labels are abbreviated without modifying stored totals. `test/clearing.test.js` now expects the earned points while preserving prior compaction assertions.

R01–R08 evidence only. Interactive colour observation, playable session, terminal lifecycle/PTY restoration and legal-gameplay integration remain later scope. No commits or downstream validation performed.

## R09 — B09 / T09

- `node --test test/game-over.test.js test/locking.test.js`: 9 passed.
- `test/game-over.test.js` checks blocked/unblocked spawn, clear-before-spawn, immutable post-game movement/rotation/descent/locking, fresh in-place restart with continued injected source, and running/game-over plain/ANSI 24-row frames with relevant controls.
- Existing `test/clearing.test.js` covers a lock completing the row that opens spawn space; `test/locking.test.js` verifies exact settled-cell preservation on blocked spawn.
- Final `npm test`: 40 passed, 0 failed, including actual bounded non-TTY `npm start`, seven-piece palette and prior R01–R08 regressions. Initial suite exposed one stale preview-controls assertion; updated it to the new running controls and reran successfully.
- Keyboard bindings are advertised for the upcoming adapter, not yet connected. PTY/termios and legal-gameplay production lifecycle checks remain T11–T13 work, not evidence claimed here.

## R10 — B10 / T10

- Focused `node --test test/session.test.js`: 4 passed. Final `npm test`: 44 passed, zero failures after final code changes; includes actual bounded non-TTY `npm start` and all prior palette/model regressions.
- `src/session.js` recovered from interrupted untracked work: sole injectable 1000 ms chained-timeout gravity owner; calls composed descent. `GRAVITY.md` documents timing, dispatch and disposal ownership.
- `test/session.test.js` verifies no early fall, one move per tick, grounded lock and single next spawn, pause freezing manual/timed play, cancellation/stale callbacks, fresh resume/restart intervals, no duplicate timers, delayed callback without catch-up, permanent idempotent disposal, and legal O stacking to game over with stopped scheduling.
- Plain and ANSI-stripped running/paused/game-over frames remain exactly 24 rows without trailing newline. Paused status and resume control replace existing rows. Full suite initially caught an obsolete exact control label in `test/model.test.js`; updated expectation and reran successfully.
- This is session-level evidence, not production interactive lifecycle evidence. Input wiring, PTY quit/termios checks and final legal-gameplay launch regression remain T11–T13.

## R12 — B12 / T12

- `src/main.js` owns home/clear redraw, cursor/raw mode, stream and signal listeners, resize and guarded input/timer callbacks. Idempotent teardown removes listeners, disposes gravity, pauses stdin and restores prior raw mode/cursor. Stream, rendering and scheduled callback failures use the same cleanup. Unrecoverable OS termination (SIGKILL) cannot be handled.
- `src/render.js` exports the measured minimum **63 columns × 24 rows** (supersedes the earlier handoff's incorrect 60-column estimate). Smaller terminals receive one truncated warning, no full frame; zero-sized terminals receive no visible text. Suitable resize restores the frame. Plain non-TTY output remains one bounded preview with no timer.
- `node --test test/terminal.test.js test/input.test.js`: 7/7 passed. `test/terminal.test.js` covers replacement frames, visible bounds, tiny dimensions, resize recovery, quit/signals/end/errors, idempotent cleanup, write failure and scheduled callback failure. Existing input tests retain legal gameplay and restart coverage.
- Final `npm test` after all code edits: **51/51 passed**, including actual non-TTY npm launch, palette and previous model regressions.
- Actual `npm start` PTY checks: Python `pty.openpty`, size via `TIOCSWINSZ`, launch with slave stdin/stdout/stderr and a new session; feed down/pause, shrink to 8×3 and send SIGWINCH, restore 80×24 and send SIGWINCH, then q or process-group SIGTERM. Both runs captured 4100 bytes, fitting warning and cursor restoration, with exact `termios.tcgetattr` equality before/after. Quit exited 0; group SIGTERM ended npm with -15 while the game restored the terminal. Initial PTY quit exposed stdin remaining live; unconditional stdin pause fixed it and both checks were rerun successfully.
- No observed plan defects. T13's full legal production clear/score lifecycle and interactive seven-colour evidence remain pending; this batch does not claim those checks.

## R11 — B11 / T11

- Latest intermediate-byte finding fix: `src/input.js` consumes ESC intermediates through their final byte across chunks. `test/input.test.js` adds packed/every-split/bytewise ESC ( q, ESC # p, space-r and multiple-intermediate regressions; production adapter preserves game, timer, raw mode and listener state, and subsequent normal keys work.
- After this code change: focused input tests 4/4; full `npm test` 48/48. Actual `npm start` Python PTY at 24x80 ignored packed and split ESC intermediate sequences, accepted arrows/pause/resume/quit, exited 0, showed cursor and restored exact termios (6155 bytes captured). These supersede earlier suite counts below.

- Focused `node --test test/input.test.js`: 3 passed. Final `npm test`: 47 passed, zero failures after final code edits, including bounded actual non-TTY npm start.
- R11 finding regression: OSC (BEL/ST) and DCS/SOS/PM/APC (ST) suppress embedded p/r/q. Decoder tests cover every two-chunk boundary and bytewise feeds; production adapter tests cover packed/every-split OSC and DCS, unchanged game/timers/raw mode/listeners, and working keys following termination. Payload storage is constant-size.
- Repeated actual `npm start` at 24x80 through Python PTY after the fix: packed OSC/DCS and split OSC ignored, arrows/pause/resume/q worked, exit 0, cursor-show observed, exact termios restored; 6155 bytes captured.
- `src/input.js` decodes real byte chunks: packed and split arrows, p pause/resume, r restart, q/Ctrl-C quit. Unknown CSI/SS3 sequences are consumed whole; no hard-drop binding is offered. `src/main.js` connects raw interactive input to the existing session actions; pipes still exit after one plain frame.
- `test/input.test.js` imports production `start` with fake terminal/clock, checks horizontal/rotation/down actions, paused gameplay freeze, unknown-input immutability, legal soft-drop stacking to game over, fresh restart, quit disposal and 24-row frames. No board/status/score edits force the lifecycle. Decoder test separately checks chunk boundaries and unknown sequences.
- Actual `npm start` smoke via Python pty.openpty at 24x80: arrows, pause, resume, q without Enter; observed noncanonical mode and Paused output, process exit 0, cursor-show escape, exact termios equality before/after quit (7182 captured bytes). This is quit-path evidence only, not signal/failure/resize coverage.
- Renderer advertises explicit Up rotate / Down drop and horizontal arrows in its single controls row. T12 still owns dimension enforcement and robust teardown; T13 still owns full legal clear/score production regression and seven-colour interactive evidence. Supplied unknown-control-string finding resolved by the decoder and production-adapter regressions above. No observed plan defects.
