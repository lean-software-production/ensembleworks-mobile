# Handoff

`src/model.js` owns canonical shapes, centered spawning, separate active/settled cells, and `canPlace(board, piece)`, shared by movement, rotation and downward steps. Rotation is clockwise in fixed square frames, no kicks; O is unchanged. Canonical I spawn rotation rejects above-board cells; other non-O spawn rotations succeed. Geometry checks live in `test/rotation.test.js`.

Task 5 adds `stepDown(state)`: a single one-row attempt returning `{ moved: true, blocked: false }` or `{ moved: false, blocked: true }`. Missing active pieces and non-running statuses also return blocked. Success replaces only the active piece with y increased by one. Rejection preserves state and active identity. This primitive never locks, merges, spawns, scores or consumes randomness. Later downward gameplay actions must distinguish frozen/absent states before deciding to lock.

`test/downward.test.js` covers all seven pieces stepping to floor and settled-row obstructions, single-cell rejection, repeated blocked attempts, board identity/content, unchanged score/status, source calls, and absent/frozen states.

Verification after final code/test change:
- `node --test test/downward.test.js`: 16 passed.
- `npm test`: 57 passed, including existing model, horizontal movement, rotation and bounded renderer checks.

`src/main.js` still renders an initial frame and exits. Locking, gameplay scheduling, input and terminal lifecycle remain later tasks. No actual npm-start PTY movement/quit check is claimed. For bounded captures use `node src/main.js` or `npm start --silent`; ordinary npm banners are not frame content.
