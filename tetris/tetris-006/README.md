# Terminal Tetris

## Run

Requires a current Node.js installation. From this directory:

```sh
npm start
npm test
```

Play in a terminal at least **22 columns × 24 rows**. The game redraws in place
and its complete board, status, and controls always use 24 rows. If the terminal
is too small, it shows a one-line warning until it is resized. Non-interactive
`npm start` output is a single bounded frame for capture-friendly use.

## Controls

- `←` / `→`: move left / right
- `↑`: rotate clockwise
- `↓`: soft drop one step (locks and spawns when grounded)
- `p`: pause or resume
- `r`: restart after game over
- `q`: quit

## Rules

The board is 10 columns by 20 rows and uses all seven standard tetrominoes.
Rotation is clockwise inside the piece's bounding box; no wall kicks are used,
so a rotation that would overlap a wall, floor, or settled block is rejected.

Gravity advances the game once every fixed **1000 ms**. It stops while paused or
after game over, and resumes with one timer only.

Scores start at zero and are awarded only when a locked piece clears lines:

| Lines | Points |
| --- | ---: |
| 0 | 0 |
| 1 | 100 |
| 2 | 300 |
| 3 | 500 |
| 4 | 800 |

Points accumulate; movement and rotation never score.
