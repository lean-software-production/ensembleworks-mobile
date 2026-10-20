# Terminal Tetris foundation

Requires Node.js 18+ and npm; no dependencies to install.

- `npm start`: prints one 24-row board snapshot and exits (B01 foundation, not yet interactive).
- `npm test`: runs model, renderer, and real launch regressions.

The board is 10×20. Rendering has 22 bordered board rows and two status rows, with no trailing newline. Plain output uses `[]` for pieces; TTY output uses seven retro ANSI colours and resets every styled span. Allow at least 40 columns for the current snapshot labels. The last row describes available model actions, not keyboard bindings (`no keys`).

Model actions are available in `src/model.js`: horizontal movement, clockwise rotation, and nonlocking single-row descent. Rotation uses fixed 4×4 (I), 2×2 (O), or 3×3 boxes, rejects invalid placements without kicks, and leaves O geometry invariant. Spawns are centered at y=0. The settled grid contains piece identities and never includes the active piece. `createState(next)` and `pieceSource(random)` allow deterministic generation.

Locking, clearing, scoring, game over, restart, gravity, keyboard input and terminal cleanup are intentionally subsequent batches. No keyboard gameplay bindings are advertised yet.
