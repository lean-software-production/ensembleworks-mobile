# Terminal Tetris foundation

Requires Node.js 18+ and npm; no dependencies to install.

- `npm start`: prints one 24-row board snapshot and exits (B01 foundation, not yet interactive).
- `npm test`: runs model, renderer, and real launch regressions.

The board is 10×20. Rendering has 22 bordered board rows and two status rows, with no trailing newline. Plain output uses `[]` for pieces; TTY output uses seven retro ANSI colours and resets every styled span. Allow at least 40 columns for the current snapshot labels. The last row describes available model actions, not keyboard bindings (`no keys`).

Model actions are available in `src/model.js`: horizontal movement, clockwise rotation, and nonlocking single-row descent. Rotation uses fixed 4×4 (I), 2×2 (O), or 3×3 boxes, rejects invalid placements without kicks, and leaves O geometry invariant. Spawns are centered at y=0. The settled grid contains piece identities and never includes the active piece. `createState(next)` and `pieceSource(random)` allow deterministic generation.

Lifecycle API: `advance(state)` moves down or, on obstruction, locks once, clears full rows, scores, and attempts one next spawn without advancing it. `lockPiece(state)` consumes the active piece; `clearLines(board)` returns the clear count. Points for 0/1/2/3/4 lines are 0/100/300/500/800; movement earns nothing. Obstructed spawns leave settled cells intact and set `game-over` with no active piece. Gameplay actions are then inert. `restart(state)` resets the same state object and consumes a fresh piece from the existing injected source stream (it does not rewind). Source ownership is external to serializable state; use the original created state or pass an explicit source to `advance`/`restart` for cloned fixtures.

Running and game-over snapshots stay at 24 rows; large scores are abbreviated beyond 16 characters. Game-over guidance exposes the model restart action, not a keyboard binding. Gravity, keyboard input and terminal cleanup remain B03 work. No keyboard gameplay bindings are advertised yet.
