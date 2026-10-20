# Terminal Tetris

Requires Node.js 20+ and npm. No dependencies to install (optional `npm install`).

- `npm start` — play in a terminal of at least **63 columns × 24 rows**.
- `npm test` — complete automated suite.
- `python3 tools/pty-smoke.py` — actual npm launch, all seven ANSI colours,
  keyboard quit and exact termios restoration (Linux/Python 3).

Left/right arrows move, Up rotates clockwise, Down soft-drops one row;
**p** pauses/resumes, **r** restarts after game over, **q** quits. No Enter
needed. There is no hard drop. Gravity advances once per **1000 ms**;
blocked descent locks, clears rows, awards points, then spawns. Pause freezes
all gameplay; resume/restart wait a fresh interval, without catch-up ticks.

The board is 10×20. Rotation uses a fixed local square (I: 4×4; other
non-square pieces: 3×3), with unchanged origin and no wall kicks. O does not
rotate. Invalid moves/rotations are rejected. Clearing 0/1/2/3/4 lines awards
0/100/300/500/800 points; movement and soft drop award none. A blocked spawn
ends the game. Restart resets board and score.

Seven retro colours distinguish pieces; borders/status are styled and reset.
The complete display is 24 rows with no trailing newline. Small terminals show
a fitting warning and recover on resize. Piped/non-TTY startup prints one
readable plain frame and exits. Quit, handled errors and interruption restore
raw mode/cursor; SIGKILL or terminal loss cannot guarantee restoration (use
`reset` if necessary).

See `VERIFICATION.md` for requirement evidence, `SCORING.md` and `GRAVITY.md`
for model details. Production composition lives in `src/main.js`; legal
launch-to-exit regression is `test/lifecycle.test.js` (only piece source,
terminal streams and clock are controlled, never board/score/status edits).
