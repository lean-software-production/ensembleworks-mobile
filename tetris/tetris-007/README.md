# Terminal Tetris

Requires Node.js 20+ and npm. No external packages or install step are needed.

```sh
npm start
npm test
```

Use an ANSI-compatible interactive terminal at least **40 columns × 24 rows**.
The complete coloured display uses 24 rows without scrolling. Smaller terminals
show a size warning and suspend play until resized. Piped/non-TTY launch prints
one bounded frame and exits; it does not start an interactive game.

## Controls

- Left/right arrows: move
- Up arrow: rotate clockwise
- Down arrow: soft drop one row, or lock if blocked
- P: pause/resume (gameplay freezes while paused)
- R: restart after game over
- Q or Ctrl-C: quit; EOF and termination signals also restore the terminal

The game uses all seven pieces, chosen independently with equal probability.
Rotations use fixed square frames with **no wall kicks**; invalid rotations leave
the piece unchanged. O does not rotate. I cannot rotate at its initial spawn
because the rotated shape would extend above the board; move down first.

Gravity falls once every **1000 ms**, with no levels or speed increases. A blocked
fall locks the piece, clears full lines, awards points, then spawns the next piece.
Start, resume, restart and each lock begin a fresh full interval; ordinary manual
moves do not reset it. There is no hard drop or catch-up after pausing.

Simultaneous clears score **100 / 300 / 500 / 800** for 1 / 2 / 3 / 4 rows.
Movement and zero-line locks earn no points. A blocked spawn ends the game.

## Verification and structure

`npm test` runs model, rendering, scheduling, input, terminal lifecycle and
production-composition integration tests. `src/main.js` exports `startGame`, the
same composition called by the launch command; tests inject legal fixtures and
fake terminal/clock dependencies, never CLI or environment cheats.
See `VERIFICATION.md` for actual-launch evidence and `HANDOFF.md` for maintenance
recipes. Interactive sessions use an alternate screen and restore raw mode,
colours and cursor on exit.
