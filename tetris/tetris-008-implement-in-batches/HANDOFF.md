# B03 handoff

T10–T13 implementation recovered and verified; prior batches preserved. `src/session.js` owns 500 ms gravity, decoder, redraw, resize and idempotent terminal cleanup. Pause/game over stop gravity; resume/restart start fresh intervals. `src/main.js` composes production; `src/render.js` preserves 24-row frames, retro palette and live controls. Minimum terminal is 40×24; non-TTY prints one plain snapshot.

Resolved R11/R12 SS3 finding: ESC O sequences consume their entire final byte without leaking pause/quit/restart bindings. Incomplete sequences persist across chunks; Ctrl-C remains out-of-band. Existing CSI handling is preserved.

`test/session.test.js` checks unsupported SS3 p/q/r/A and parameterized sequences at every split (including same-chunk), unchanged state/redraw/raw mode, subsequent arrow recovery, and incomplete-SS3 Ctrl-C cleanup. `test/pty-smoke.py` reproduces same-chunk and split SS3 through actual npm start and checks pending-SS3 interruption.

Verification after final code changes: `node --test test/session.test.js` 5/5; `npm test` 19/19; `python3 test/pty-smoke.py` five exit cases passed with exact termios/cursor restoration and seven ANSI palette codes. Production fixture `test/support/production.mjs` reaches fall, lock, two-line clear/300 points, game over, restart and quit through legal gameplay; 304 frames remain bounded. Requirement evidence is in VERIFICATION.md.

No plan defects found. Unrelated workspace changes untouched. Remaining: downstream validation and commit, neither performed. Colours observed as PTY ANSI codes, not human visual inspection; PTY checks require POSIX/Python.
