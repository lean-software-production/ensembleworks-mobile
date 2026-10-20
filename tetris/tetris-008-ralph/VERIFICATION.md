# Verification

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
