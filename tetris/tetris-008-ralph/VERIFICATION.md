# Verification

## R01 — B01 / T01

- `npm test`: passed 2 tests, 0 failures after final code changes (Node v24.21.0, npm 11.19.0).
- `test/render.test.js`: verifies 10×20 empty cells, top/bottom borders, zero score, controls, deterministic pure rendering, exactly 24 rows counting untrimmed newlines, and no ANSI/carriage returns.
- Same suite launches literal `npm start` in the target via piped subprocess: exit 0, empty stderr, exact renderer output, no trailing newline and no extra npm banner rows.
- `npm start > /tmp/tetris-008-ralph-start.txt` followed by Node assertions: 24 rows, no trailing newline, bounded exit. Initial manual check exposed npm banner overhead; `.npmrc` resolves it and the literal-launch regression covers it.

Only R01 is implemented in this batch. Interactive play, palette, terminal lifecycle/PTY restoration, and legal-gameplay integration remain future scope; no such evidence is claimed. No commits or downstream validation performed.
