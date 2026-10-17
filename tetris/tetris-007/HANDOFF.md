# Handoff

`src/model.js` owns canonical shapes, centered spawning, separate active/settled cells, and the shared `canPlace(board, piece)` predicate. Movement and rotation reuse that predicate.

Task 4 adds `rotateClockwise(state)`, returning `{ rotated: true/false }`. Rotation maps local coordinates to `[size - 1 - y, x]` in fixed frames without kicks or origin changes. Rejection preserves the entire state and active-piece identity. O is a no-op returning false. Missing pieces and non-running statuses reject rotation. No randomness is consumed.

`test/rotation.test.js` documents exact canonical geometry and spawn outcomes: I rejects because its frame origin y=-1 would produce an above-board cell; O stays unchanged; T/S/Z/J/L rotate legally. Tests cover four-turn restoration, four distinct valid cells, both walls, floor, settled collisions, frozen states, board separation and random-source calls. The wall fixture uses a vertical I at frame x=-1 or x=7 (occupied local column 2); x=8 would already be invalid.

Verification after final code/test change:
- `node --test test/rotation.test.js`: 17 passed.
- `npm test`: 41 passed, including existing movement/model/render checks and frame bounds.

`src/main.js` still renders one initial frame and exits. Downward movement, locking, keyboard input, timers and terminal lifecycle remain later tasks. No actual npm-start PTY movement/quit check is claimed. For bounded captures use `node src/main.js` or `npm start --silent`; ordinary npm banners are not frame content.
