# Handoff

Task 12: `src/terminal.js` owns terminal capabilities, alternate screen, raw mode, cursor, redraw, resize, signals and idempotent cleanup. `src/main.js` calls `startTerminal`; `src/session.js` retains gameplay/timer ownership. Dependencies are injectable. Redraw erases owned rows and uses CRLF without a trailing newline. Resize clears the alternate screen before frame/warning; undersize suspends gameplay, recovery preserves state. Non-TTY emits one bounded frame without raw mode or timers.

Resolved review subtask: asynchronous Writable destruction previously outlasted the deferred error-handler removal. `finish()` now waits while a destroyed stream is not closed; a close listener retries finalization. Pending writes still drain first. Finalization removes error/close listeners and reports exit once. `test/terminal.test.js` adds controlled destruction delayed at least 30 ms, verifying error-handler retention, deferred unsuccessful exit, one diagnostic and eventual listener removal. Existing pending-write/restoration-error regressions remain.

Fresh recovery rerun confirmed the following checks; `VERIFICATION.md` records the evidence. No code/test changes followed verification:
- `node --test test/terminal.test.js`: 14 passed.
- `npm test`: 124 passed.
- `node src/main.js > /tmp/tetris-frame`: success; ANSI-stripped output exactly 24 rows, no trailing newline.
- Python `pty.openpty()`, slave TIOCSWINSZ 24x40, `subprocess.Popen(['npm','start'], stdin=slave, stdout=slave, stderr=slave)`: wait for `Q:quit`, check ICANON disabled, send left arrow and observe redraw, send q; exit 0, original termios restored, alternate-screen enter/reset/cursor-show/leave verified.

Use actual entry point or silent npm for bounded captures: npm banners add rows. Task 13 documentation and deterministic composition gameplay integration remain deferred. No fixture CLI/environment controls exist.
