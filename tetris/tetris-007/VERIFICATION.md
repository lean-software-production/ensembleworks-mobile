# Task 12 verification

Recovered and inspected the existing terminal lifecycle implementation in `src/terminal.js`, entry-point wiring in `src/main.js`, and regressions in `test/terminal.test.js`.

Checks rerun successfully:

- `node --test test/terminal.test.js`: 14 passed, 0 failed. Covers in-place redraw, resize clearing/warning clipping, suspension/recovery, quit/signals/EOF, idempotent cleanup, raw-mode preservation, and synchronous/asynchronous output failures (including delayed destruction).
- `npm test`: 124 passed, 0 failed.
- Python `subprocess.run(['node', 'src/main.js'], capture_output=True, timeout=5)`: exit 0; ANSI-stripped output has exactly 24 rows, each at most 40 columns, with no trailing newline.
- Actual `npm start` via Python `pty.openpty()`, slave window set using `TIOCSWINSZ` to 24 rows × 40 columns: waited for `Q:quit`, confirmed ICANON disabled, sent left arrow and observed another frame, sent `q`, and confirmed exit 0. Original slave termios matched after exit; captured output contained alternate-screen entry and colour-reset/cursor-show/alternate-screen-leave cleanup.

No code/test changes were needed after these reruns. Task 13's deterministic full-game composition regression and user documentation remain outside this task; these checks do not claim that integration coverage.
