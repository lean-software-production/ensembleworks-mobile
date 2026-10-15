# Verification report

Date: 2026-10-15

## Checks performed

| Check | Command / method | Outcome |
| --- | --- | --- |
| Automated suite | `npm test` | Passed: 48 tests, 0 failures. This includes the deterministic scripted application-adapter session for movement, rotation, timer descent, lock, clear, 100-point score, game over, and quit. |
| Non-interactive policy | `node index.js > /tmp/tetris-frame.out` | Exited without waiting for input and produced one frame. The captured frame has 23 newline-terminated logical rows. |
| Interactive launch and quit | Python standard-library `pty.fork()` harness running `npm start --silent` at 53×24, then sending `q` | Saw `TETRIS`, alternate-screen entry, and cursor/alternate-screen restoration on exit. |
| Interactive final display | The same 53×24 PTY harness, sending 100 Space keys then `q` | Saw `GAME OVER` and `Score:` in the live output, then clean terminal restoration. |
| Interactive resize | PTY harness started at 53×24, changed to 52×23, restored 53×24, then sent `q` | Saw `Terminal too small`, four in-place redraws, and clean restoration. |
| Width and height bounds | `npm test` frame tests | Normal frame is 23 rows; the game-over frame is 24 rows. Tests verify the 10×20 board, required score/controls/game-over labels, and no wrapping at the documented 53-column minimum. The size warning is one bounded line. |

## Requirement coverage

- `npm start` runs the terminal game; `npm test` runs the automated checks.
- The visible game is a bordered 10×20 board with score, controls, and an
  in-frame game-over message, bounded to 24 rows.
- The actual PTY checks exercised launch, hard-drop play through a final-score
  game-over display, resize warning/recovery, quit, and terminal cleanup.
- The README documents installation, commands, controls, minimum dimensions,
  scoring, rotation and immediate-lock policies, gravity behavior, and the
  non-TTY one-frame-and-exit policy.

## Limitations

The PTY smoke tests are automated rather than a human visual inspection. They
assert terminal escape sequences and required rendered text but do not measure
physical font rendering. No external packages or network installation were
needed.
