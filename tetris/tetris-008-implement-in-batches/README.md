# Terminal Tetris

Requires Node.js 18+ and npm; no dependencies to install. Run `npm start` to play and `npm test` for regressions. POSIX terminal smoke: `python3 test/pty-smoke.py`.

Use a terminal at least **40 columns × 24 rows**. The 10×20 board, borders, score, state and controls occupy exactly 24 rows with no trailing newline. Smaller terminals show a fitting warning; resizing restores play. Non-TTY launch prints one readable plain snapshot and exits.

- Left/right arrows: move; up: clockwise rotation; down: soft drop (locks when blocked).
- `p`: pause/resume; `r`: restart after game over; `q` or Ctrl-C: quit.
- No hard drop, hold, preview, levels or wall kicks.

Gravity advances once every **500 ms**. Pause and game over stop the timer; resume/restart begin a fresh interval without catch-up. Rotation uses fixed local square boxes (I:4, O:2, others:3); O stays unchanged and invalid placements are rejected. Spawns are centered and fully visible. Pieces are independent uniform random choices, not a bag.

Locking clears full rows before the next spawn. Score for 0/1/2/3/4 lines is **0/100/300/500/800**, once per lock. A blocked next spawn ends play without overwriting the board. Restart resets board and score and consumes the next random piece.

Seven ANSI piece colours and cyan borders retain a retro display. Raw input, cursor and timers are restored on quit, interruption and handled I/O failures. Terminal colour appearance depends on the emulator/theme.

## Source and verification

`src/model.js`: deterministic geometry and progression; `src/render.js`: pure ANSI/plain frames; `src/session.js`: input, clock and terminal lifetime; `src/main.js`: actual entry point.

`test/foundation.test.js`, `test/lifecycle.test.js`, and `test/session.test.js` cover model, display and session boundaries. `test/support/production.mjs` launches the actual entry in an isolated process with controlled terminal/time/randomness: legal inputs/ticks reach a clear, score, game over, restart and quit, with no state edits. `test/pty-smoke.py` runs actual npm start, checks seven palette codes and compares termios before/after quit and Ctrl-C. See `VERIFICATION.md` for evidence.
