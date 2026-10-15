# Verification report

Verified 2026-10-15 from the project root.

| Check | Command | Outcome |
| --- | --- | --- |
| Automated game and input tests | `npm test` | Passed: 8 tests, 0 failures. This covers spawning, movement, rotation, collision, gravity, locking, line clearing/scoring, game over, and combined/split keyboard escape sequences. |
| Rendered display size and colours | `node - <<'NODE' ... NODE` (renders `renderScreen(createGame(() => 0))`, strips ANSI sequences, and counts lines) | 24 rows exactly; widest visible row was 42 columns. The screen contained title, controls, and status. ANSI output included bold/dim plus magenta, cyan, blue, yellow, green, and red colours. |
| Game-over rendering | `node - <<'NODE' ... NODE` (renders a game with `status = 'Game over'`) | The rendered screen contained `Game over` and remained 24 rows. |
| Terminal startup, keyboard play, game over, and clean exit | `{ printf ' dws'; printf '                                                                                                    q'; } \| script -q -c 'npm start' /tmp/tetris-play.out` | Exited 0. The captured pseudo-terminal session rendered 105 frames, including `Game over`, and contained the cursor-restoration sequence (`\x1b[?25h`). A separate `printf 'q' | script -q -c 'npm start' /tmp/tetris-startup.out` check exited 0 and confirmed title output, cursor hiding/restoration, and style reset. |

## Limitations

Checks were automated with a pseudo-terminal and captured output. No human visual or interactive terminal session was performed, so terminal-specific colour appearance and real keyboard feel were not manually assessed.
