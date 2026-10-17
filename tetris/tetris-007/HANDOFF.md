# Handoff

`src/model.js` owns canonical shapes, centered spawning, shared `canPlace`, movement, no-kicks clockwise rotation, and `stepDown` (moves/blocks without locking). Canonical I spawn rotation rejects above-board cells; other non-O spawn rotations succeed; O is unchanged.

Task 6 adds `lockPiece(state, typeSource)` and `descend(state, typeSource)`. Pass the same injected source across initial creation and later actions. Lock requires a running, valid, grounded active piece. It copies four type-valued cells, preserves unrelated board cells and score, consumes one next type, and attempts spawn once. Results expose `locked`, `spawned`, and `spawnBlocked`; descend also exposes `moved`. Successful descent never locks or advances the new piece. Rejected locks consume nothing. Invalid source types throw before mutation.

Blocked spawn currently leaves `active: null`, status running, and `spawnBlocked: true`; later actions do not retry. Task 9 owns the game-over transition. Tasks 7/8 must insert clearing/scoring between settling and next-spawn placement; neither is implemented here.

Tests: `test/locking.test.js` covers all shapes, exact board writes, grounded obstructions, source consumption, no same-action next-piece movement, blocked spawn, absent/frozen/invalid/ungrounded locks, and invalid source atomicity. Existing downward/rotation/movement/model/render tests remain.

Verification recipes after final code/test change:
- `node --test test/locking.test.js`: 17 passed.
- `npm test`: 74 passed, including bounded renderer checks.

`src/main.js` still renders once and exits. Scheduling/input/terminal lifecycle belong to later tasks; no PTY gameplay check is claimed. Bounded capture: `node src/main.js` or `npm start --silent` (ordinary npm banners are not frame content).
