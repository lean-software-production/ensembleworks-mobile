# Handoff

Task 1 adds `src/render.js` (pure renderer, empty board factory, ANSI stripping and frame measurement), `src/main.js` (one-shot launch), and `test/render.test.js`.

Snapshot schema: 20×10 board containing null or I/O/T/S/Z/J/L; optional active `{type, cells: [{x,y}]}` uses absolute cells. Score defaults to zero; phases currently accept running, paused, and `game over` (also gameOver). Renderer copies rows before overlay. It emits 24 rows without a trailing newline, at most 52 visible columns. Seven distinct ANSI colours distinguish pieces; border/status are styled; plain cells use doubled type letters. Huge score display is abbreviated without modifying score.

Verification: `node --test test/render.test.js`, then `npm test` (3 passing). `npm start > /tmp/tetris-task1-start.txt` checks launch; for bounded capture use `node src/main.js` or `npm --silent start` because npm banners add rows. Actual `npm start` also launched successfully under Python `pty.openpty()`/`subprocess.Popen`, rendered score/controls, and exited 0.

No dependencies or installation required on Node >=20. Interactive colour requires both streams to be TTYs. Current entry point only emits a snapshot and exits: no raw mode, timers, input, gameplay, resize handling or persistent redraw yet. Later tasks must introduce these through the accepted boundaries. PTY quit/cleanup and full gameplay integration remain future work.
