# Terminal Tetris

Requires Node.js 18+ and npm. No dependencies to install; run `npm start`.
Run `npm test` (also requires Python 3 and Unix PTY support).

Use a terminal at least **52 columns × 24 rows**. The entire game is 24 rows,
without a trailing newline. Smaller terminals show a fitting warning; resizing
restores the game. Gravity continues while the window is small. Non-TTY launch
prints one plain, bounded frame and exits. Interactive play uses an alternate
screen, raw input, in-place redraw, and seven retro ANSI piece colours.

- Left/right arrows: move one column
- Up arrow: clockwise rotation
- Down arrow: soft drop one step, locking if blocked
- `p`: pause/resume (gameplay input ignored while paused)
- `r`: restart after game over
- `q` or Ctrl-C: quit; SIGINT/SIGTERM/SIGHUP also clean up

The 10×20 board stores settled cells separately from the active piece. Gravity
attempts one downward step every **1000 ms**; a blocked step locks, clears,
scores, then spawns once. Spawned pieces do not fall within that same action.
Pause cancels gravity; resume and restart begin a fresh interval, with no catch-up.

Clockwise rotation uses a 3×3 local box (I uses 4×4). O is unchanged.
Invalid rotations are rejected with no wall kicks. Spawns are centered at row
zero (I's horizontal cells occupy local row one). Points for 0/1/2/3/4 lines
are **0/100/300/500/800**. Movement gives no points. An obstructed spawn ends the
game after clearing; restart resets board, score and pause state, continuing
the piece source. No hard drop, levels, hold, or preview is advertised.

For reproducible play, `TETRIS_SEED=123 npm start` selects a seeded generator.
`TETRIS_PIECES=IOTSZJL npm start` cycles an explicit piece stream, overriding the
seed. These affect generation only, never mutate the board. Normal play chooses
uniform random pieces independently.

`test/integration.test.js` launches the real entry point with controlled I/O and
clock. Its legal lifecycle fixture uses only O pieces: place five at x=0,2,4,6,8
with arrows, drop each until locked (19 down attempts from spawn), clearing two
rows for 300 points. Then stack ten at spawn x=4 with 19,17,…,1 down attempts;
the next spawn is obstructed. Restart and quit complete the regression.
The first fixture piece receives one gravity tick and therefore needs 18 drops.
See `VERIFICATION.md` for evidence and `HANDOFF.md` for maintenance notes.
