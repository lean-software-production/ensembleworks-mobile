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

R01–R05 evidence only. Interactive colour observation, playable session, terminal lifecycle/PTY restoration and legal-gameplay integration remain later scope. No commits or downstream validation performed.
