# Handoff

B01 T01–T13 implementation preserved and rechecked. Findings R11-UNKNOWN-ALT
and earlier R11-UNKNOWN-SS3 corrected. No evidenced plan defects. Accepted
bookkeeping and unrelated parent changes untouched; no commit made.

Sources: `src/model.js` owns board, active piece and lock→clear→score→spawn;
`src/render.js` produces 24 rows without trailing newline; `src/input.js`
consumes unsupported Alt/CSI/SS3 keys across chunks without leaking controls;
`src/session.js` owns timers, redraw and cleanup; `src/main.js` launches.

Choices: 10×20 board; rejected invalid clockwise box rotations, no kicks; O
unchanged; 1000 ms gravity; 0/100/300/500/800 points. Minimum 52×24 terminal;
small-terminal warning and non-TTY single plain frame. Resume/restart use fresh
timers. Restart continues generation. Seven ANSI piece colours and styled status.

Verification: `node --test test/session.test.js` passed five tests;
`python3 test/pty.py` passed eight actual npm-start launches. Final `npm test`
passed 14 Node tests and all eight PTYs after final code edits. Alt+p/q/r
combined/split regressions cover decoder boundaries, running/game-over sessions,
subsequent direct controls, and actual PTY recovery. PTYs check nine bounded
frames each, seven colours, quit/SIGINT and exact termios restoration.

`test/integration.test.js` with `test/entry-preload.js` controls only I/O/time:
five legally placed O pieces clear two rows/300; ten centered O pieces reach
game over, then restart/quit. README documents drops. `VERIFICATION.md` maps
R01–R13 to evidence.

Remaining: external validation/commit; no human visual colour assessment or
Windows testing. No further implementation work identified.
