# Handoff

Task 13 adds `README.md` and `test/integration.test.js`. `src/main.js` now exports
`startGame` (the production `startTerminal` composition) and invokes it only when
launched directly. Tests import this same entry point without launching a second
session. Fixtures remain dependency-injected only; no CLI/environment cheats.

Integration starts with a legal I above a bottom-row gap and a top obstruction.
Two ticks produce fall -> lock -> one clear/100 points -> blocked O/game over;
then input tests frozen gameplay, restart, pause/resume and quit. Frames in all
states are bounded to 24 rows/40 visible columns. Actual non-TTY subprocess exits
successfully. Model/input/session/terminal ownership remains unchanged.

Verification recipes:
- `node --test test/integration.test.js`: 2 passed.
- `npm test`: 126 passed after final code/test change.
- `node src/main.js > /tmp/tetris-007-frame`: strip ANSI; assert 24 rows,
  <=40 columns and no trailing newline. Do not use npm banners for frame counts.
- Actual `npm start` PTY: Python `pty.openpty`, set slave TIOCSWINSZ to 24×40,
  save termios, launch subprocess with slave stdin/stdout/stderr; wait for
  `Q:quit`, assert ICANON off, send left arrow and compare changed redraw, send q,
  await exit 0, compare exact saved termios and assert reset/show/alternate-leave.

`VERIFICATION.md` records performed checks. Terminal asynchronous output cleanup
waits for pending writes and destruction before removing error listeners; preserve
those regressions in `test/terminal.test.js`. Real-terminal visual portability is
not exhaustively tested. No unresolved requirement failures.
