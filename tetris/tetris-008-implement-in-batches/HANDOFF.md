# B01 handoff

Source: `src/model.js` owns 10×20 settled identity grid, separate active geometry, shared placement, horizontal movement, clockwise rotation and nonlocking descent. `src/render.js` is pure; `src/main.js` prints a single bounded snapshot and exits. Recovered existing B01 files and verified all six regressions. Unrelated workspace modifications were left alone.

Geometry: I rotates in 4×4, O in 2×2 (invariant), others in 3×3; no kicks. Spawn boxes centered at y=0. Rejection preserves state. Successful actions replace only active piece. `stepDown` returns `{moved, blocked}` without locking or consuming generation. `createState(next)` accepts an injected type source; `pieceSource(random)` accepts injected randomness. State includes zero score and running status for progression integration.

Verification: `node --test test/foundation.test.js` and `npm test`; tests cover all seven types, ANSI palette/reset output, exact 24-row frames without trailing newline, actual non-TTY npm launch, rotation collisions, both walls, settled obstacles, and repeated nonlocking descent. See `VERIFICATION.md`.

Finding resolved: last row now truthfully lists model actions and `no keys`; exact pure-render/launch assertions replace the placeholder check. Snapshot labels require 40 columns. Focused/full suites each passed all six tests; independent npm capture confirmed 24 rows and plain output.

Remaining: B02 implements lock→clear→score→spawn/game-over and restart. B03 owns timers/input/resize/cleanup and true interactive rendering. Its production lifecycle fixture must reach clears/game-over through legal inputs/ticks; no lifecycle fixture exists yet. Verify seven colours interactively and actual npm start PTY quit/termios then. Current launch acquires no terminal resources and exits immediately. No plan defects found.
