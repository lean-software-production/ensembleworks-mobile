# Handoff

`src/model.js` owns seven canonical tetrominoes, centered spawning, injected type sources, and separate settled/active cells. Task 3 adds `canPlace(board, piece)`, reused by initial spawn and horizontal movement. It checks occupied cells against all four bounds and settled cells only (never the active piece). I's frame origin may be y=-1 while occupied cells remain valid.

`moveLeft(state)` / `moveRight(state)` mutate only `state.active` on success and return `{ moved: true }`; rejection returns `{ moved: false }` without changing state or active-piece identity. Each successful action moves exactly one column. Missing pieces and non-running statuses reject movement. No randomness is consumed. Future rotation/downward/spawn actions should reuse `canPlace`.

`test/movement.test.js` covers all shapes, both walls under repeated input, settled-cell rejection, self-overlap, bounds, absent pieces, frozen statuses, board separation and random-source call counts. Existing model/render tests retain canonical spawn and 24-row frame checks.

Verification:
- `node --test test/movement.test.js`: 11 passed.
- `npm test`: 24 passed after final source/test edits.

`src/main.js` still renders one initial frame and exits. Keyboard controls, rotation, downward movement, locking, timers and terminal lifecycle are later tasks. No actual npm-start PTY movement/quit test is claimed; interactive handling does not yet exist. For bounded captures use `node src/main.js` or `npm start --silent`, since normal npm banners are not frame content.
