# Terminal Tetris

A compact terminal Tetris game with a 10×20 board. The complete game display
is at most 24 rows tall.

## Run

This project has no third-party runtime dependencies. From the project root:

```sh
npm start
npm test
```

`npm start` opens the interactive game only when both standard input and output
are TTYs. When run through a pipe, redirected output, or CI, it prints one
empty readable frame and exits instead of waiting for input.

## Play

Use a terminal of at least **53 columns by 24 rows**. Resize smaller than that
and the game pauses with a one-line size warning; it resumes when the terminal
fits again, without applying accumulated gravity time.

| Key | Action |
| --- | --- |
| Left / Right arrows | Move one column |
| Up arrow | Rotate clockwise |
| Down arrow | Move down one row |
| Space | Hard drop and lock |
| Q or Ctrl-C | Quit |

The game redraws in place in an alternate screen and restores the cursor and
terminal mode on quit, termination, or handled errors.

## Rules

- The seven standard tetrominoes spawn centered at the visible top of the
  board. Gravity moves once per second.
- Rotation is clockwise with **no wall kicks**. A rotation that would leave the
  board or collide with settled cells is rejected; the square footprint does
  not change.
- A piece locks immediately when it cannot move down. A hard drop uses the
  same lock path and has no drop-point bonus.
- Completed rows clear simultaneously after a lock, before the next piece
  spawns. If that next piece cannot fit, the game ends and the final board and
  score remain visible.
- Scores are awarded once per lock: 1 line = 100, 2 = 300, 3 = 500, and 4 =
  800. There are no levels, speed changes, or drop points.
- Time updates process at most ten gravity steps; excess delayed time is
  discarded. Locking or resuming after a resize resets timing debt.
