# Task 13 launch-to-exit verification

- `node --test test/launch.test.js`: 1 passed. Injected TTY I/O, deterministic O/I/I/O source and fake 1000 ms interval through the exported `src/index.js` launch entry. Asserted timed fall, locking, one-row clear/100 points, blocked next spawn, game-over message, restart/reset, quit/resource cleanup, and all emitted frames exactly 24 rows and no wider than 50 columns.
- `npm test`: 43 passed, 0 failed (complete automated suite).
- `npm start` in a Python PTY sized 50×24: saw running controls, sent `p` and saw paused message, sent `q`; process exited 0 and showed cursor (`ESC[?25h`).
- `node src/index.js > /tmp/tetris008-frame.txt`: non-TTY startup exited; 24 lines, maximum width 50.
- `git diff --check -- README.md HANDOFF.md VERIFICATION.md test/launch.test.js`: clean.

Limitations: actual-command PTY smoke checks running/pause/quit, not game-over/restart; the injected launch-path regression checks the latter. No known unmet requirements.
