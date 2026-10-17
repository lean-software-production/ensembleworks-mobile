# Handoff

Task 2 adds `src/model.js`: immutable seven canonical shape definitions, independent empty boards, injected type-source initial generation, uniform random-source factory, centered spawn coordinates and absolute active-cell projection. Fixed frames are I=4, O=2, others=3; I occupies local row 1 and spawns with frame y=-1. Occupied cells all start in bounds. Active cells remain separate from settled board cells. Shape cell arrays are copied into pieces for future rotation.

`src/render.js` remains pure and re-exports the empty-state helper/constants for compatibility. Active pieces use per-type retro colours and `[]` glyphs. `src/main.js` renders one randomly generated initial state and exits; interactive controls and lifecycle are not yet implemented.

Verification performed:
- `node --test test/model.test.js`: 9 passing tests (all shapes, centered placement, independent cells, scripted/uniform generation, rendering purity/bounds).
- `npm test`: all 13 tests pass, including actual Node entry-point capture.
- `npm start`: exits successfully.
- `npm start --silent > /tmp/tetris-007-frame`: stripping SGR gives 24 rows, maximum width 35, four active cells, no trailing newline.

`test/render.test.js` retains empty-frame checks and now expects four active cells from the entry point. Use silent npm or direct Node for bounded captures; normal npm banners are not frame content. No PTY launch/quit verification yet: input, raw mode, movement, timers and cleanup belong to later tasks. Shared collision predicate is deferred to task 3; no movement/rotation/locking is implemented.
