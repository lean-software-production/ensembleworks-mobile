# Handoff

`src/model.js` owns gameplay through game over/restart (task 9). `lockPiece` locks, compacts rows, awards 0/100/300/500/800 points, then attempts one spawn. An obstructed spawn sets `status: 'game-over'` and `active: null`, preserving the settled board and earned score. Existing gameplay actions reject non-running states without consuming types.

`restart(state, typeSource)` only accepts game over, builds a fresh initial state before mutation, resets board/score/status/active, and consumes one fresh type. Callers must keep using the same injected source; restart does not rewind it. Running/paused restart is a no-op.

`src/render.js` shows Running or Game over in the score row, and replaces gameplay controls with R:restart Q:quit after loss. Score abbreviation keeps frames exactly 24 rows and at most 40 visible columns, without a trailing newline.

`test/game-over.test.js` covers blocked/unblocked spawns, clear-before-spawn ordering, earned-score preservation, frozen actions, restart and contextual frame bounds. `test/locking.test.js` now expects game-over status on blocked spawn.

Verified after final code/test changes:
- `node --test test/game-over.test.js test/locking.test.js test/render.test.js`: 26 passed.
- `npm test`: 97 passed (includes actual bounded entry-point capture).

`src/main.js` still renders once and exits; scheduling, keyboard dispatch, and terminal lifecycle remain later tasks. No interactive gameplay or PTY cleanup check is claimed. Bounded capture: `node src/main.js` or `npm start --silent` (npm banners otherwise add rows).
