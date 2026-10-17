# Task 13 verification

Implemented `README.md`, the import-safe production `startGame` export in
`src/main.js`, and `test/integration.test.js`. No fixture CLI/environment controls.

Checks performed after the final code/test change:

- `node --test test/integration.test.js`: 2 passed. Fake-TTY production composition
  uses a legal I fixture, falls once, locks once, clears one line for 100 points,
  hits a blocked O spawn, rejects frozen gameplay, restarts with T, pauses/resumes,
  and quits. Every emitted game frame is 24 rows and at most 40 visible columns.
  Cleanup removes listeners/timers and restores raw mode and screen. Separate
  subprocess test launches the real non-TTY entry point and exits 0 within 3 s.
- `npm test > /tmp/tetris-007-tests.log 2>&1`: 126 passed, 0 failed.
- `node src/main.js > /tmp/tetris-007-frame`, followed by Python ANSI-stripped
  row/column assertions: exactly 24 rows, at most 40 columns, no trailing newline.
- Actual `npm start` under Python `pty.openpty()` with slave `TIOCSWINSZ` 24×40:
  waited for `Q:quit`, verified ICANON disabled, sent left arrow and asserted a
  changed board frame, then sent q. Exit 0; complete original termios restored;
  alternate-screen enter, colour reset, cursor show and alternate-screen leave
  sequences verified. The PTY driver used select with bounded waits and killed
  the process on failure; no failure occurred.

Limitations: actual-launch coverage is a PTY smoke test, not a human visual review
across terminal emulators. Long gameplay is covered deterministically rather than
by waiting for random pieces in the real process. No known requirement failures.

## Prior task 12 verification

Recovered and inspected the existing terminal lifecycle implementation in `src/terminal.js`, entry-point wiring in `src/main.js`, and regressions in `test/terminal.test.js`.

Checks rerun successfully:

- `node --test test/terminal.test.js`: 14 passed, 0 failed. Covers in-place redraw, resize clearing/warning clipping, suspension/recovery, quit/signals/EOF, idempotent cleanup, raw-mode preservation, and synchronous/asynchronous output failures (including delayed destruction).
- `npm test`: 124 passed, 0 failed.
- Python `subprocess.run(['node', 'src/main.js'], capture_output=True, timeout=5)`: exit 0; ANSI-stripped output has exactly 24 rows, each at most 40 columns, with no trailing newline.
- Actual `npm start` via Python `pty.openpty()`, slave window set using `TIOCSWINSZ` to 24 rows × 40 columns: waited for `Q:quit`, confirmed ICANON disabled, sent left arrow and observed another frame, sent `q`, and confirmed exit 0. Original slave termios matched after exit; captured output contained alternate-screen entry and colour-reset/cursor-show/alternate-screen-leave cleanup.

No code/test changes were needed after these reruns. Task 13's deterministic full-game composition regression and user documentation remain outside this task; these checks do not claim that integration coverage.
