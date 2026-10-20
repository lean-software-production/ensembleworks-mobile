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

R01–R03 evidence only. Interactive colour observation, playable session, terminal lifecycle/PTY restoration and legal-gameplay integration remain later scope. No commits or downstream validation performed.
