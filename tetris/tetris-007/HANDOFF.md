# Handoff

`src/model.js` owns gameplay through locking/clearing. Task 8 adds frozen `LINE_POINTS`: 0/100/300/500/800 for simultaneous clears of 0–4 rows. `lockPiece` adds the award exactly once using `clearedRows`, after compaction and before next spawn. Movement, rotation, rejected locks and zero-line locks award nothing. Blocked spawn preserves earned points; game-over status remains task 9 (currently running with active null and explicit `spawnBlocked`).

`src/render.js` already renders live score in the reserved status row and abbreviates long score strings without changing model state. Frames remain 24 rows, at most 40 visible columns, no trailing newline.

`test/scoring.test.js` covers all five awards, repeated-lock protection, accumulation, non-scoring actions, blocked-spawn score preservation, live display and large-score bounds. `test/clearing.test.js` now expects its single-clear award. Existing clearing and locking contracts remain intact.

Verified after final code/test changes:
- `node --test test/scoring.test.js test/clearing.test.js test/render.test.js`: 22 passed.
- `npm test`: 92 passed.

`src/main.js` still renders once and exits; scheduling, input, and terminal lifecycle belong to later tasks. No PTY gameplay check is claimed. For bounded output capture use `node src/main.js` or `npm start --silent` to avoid npm banners. Keep injected type sources consistent across model actions; next type validation occurs before lock mutation.
