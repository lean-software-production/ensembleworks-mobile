# Handoff

B13/T13 adds `README.md`, `test/lifecycle.test.js` and `tools/pty-smoke.py`; production code and previous batches unchanged. No interrupted target code needed recovery; unrelated workspace changes preserved.

Production composition regression imports `src/main.js` and invokes `start` with fake terminal/clock and fresh injected O source. Legal tick/input produces fall, lock, two-row clear/300 points, centered stacking to game over, restart and quit. Every game frame is exactly 24 rows without trailing newline. No board/score/status edits force events. Separate production palette test covers all seven ANSI codes.

Recipes: `node --test test/lifecycle.test.js` passed 2/2; final `npm test` passed 53/53 after final code edits (capture `.assembly-lines/b13-tests.log`). `python3 tools/pty-smoke.py` passed seven actual npm start launches on 80×24 Linux PTYs: each colour, down/pause/resume/quit, exit 0, cursor and exact termios restoration. O PTY additionally legally clears/scores, stacks to game over and restarts before quit. Randomness-only preload lives in a temporary target directory and is removed automatically.

`VERIFICATION.md` maps R01–R13 to tests and records final evidence, superseding historical pending notes. README documents 63×24 minimum, rules, commands and bindings. No observed plan defects. No remaining implementation work identified; downstream validation and commits are not performed here. PTY verifies colour escape bytes rather than human perception; Python/Linux needed for separate smoke. SIGKILL cannot restore terminal state.
