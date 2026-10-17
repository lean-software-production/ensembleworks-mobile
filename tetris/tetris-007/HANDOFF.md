# Handoff

Task 11 adds `src/input.js`: bounded streaming byte decoder for ANSI/application arrows, P/R/Q (either case), Ctrl-C; escape/control-string payloads are discarded rather than replayed as gameplay keys. Task 11 review subtasks resolved: escape-intermediate, DCS/BEL and SOS payload leakage. ESC intermediate bytes consume their final byte; only OSC accepts BEL termination, while DCS/SOS/PM/APC require ST. SOS (`ESC X`) is recognized, including payload BEL bytes. Split-boundary and bytewise adapter tests assert no gameplay mutation or quit, then verify ordinary controls resume after ST. `attachInput` dispatches into the existing session owner; quit/EOF stops timers and removes its listeners exactly once, ignoring remaining keys in the chunk.

`src/main.js` now wires interactive TTY input without Enter, redraws on session changes, and restores prior raw mode on input quit/EOF. Non-TTY still renders once and exits. This is minimal wiring: alternate screen, resize, cursor handling, signal/failure cleanup and undersize suspension remain task 12. Do not mistake the current home-cursor redraw for complete terminal lifecycle support.

`src/session.js` owns fixed 1000ms gravity and serialized actions; lock/resume/restart re-arm, ordinary movement preserves deadlines. `src/model.js` owns all gameplay; rendering is pure and 24 rows with no trailing newline.

Verification after final code/test changes:
- `node --test test/input.test.js`: 5 passed (all byte splits, bounded unknown sequences, scripted gameplay, EOF/Ctrl-C).
- `npm test`: 110 passed.
- Python `pty.openpty()` + `subprocess.Popen(['npm','start'], stdin=slave, stdout=slave, stderr=slave)`: waited for `Q:quit` controls (not `Q quit`), asserted ICANON disabled, sent left arrow and observed redraw, sent q, asserted exit 0 and slave termios equals prelaunch state.

Use `node src/main.js` or `npm start --silent` for bounded output capture; npm banners add rows. Task 13 still needs shared production composition integration and final launch regression/report.
