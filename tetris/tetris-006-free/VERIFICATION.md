# Verification

- `npm start` — passed in non-TTY mode; printed a board, score, controls, and exited normally.
- `node` gameplay smoke script — passed: checked rendered output is at most 24 lines, movement, rotation, hard drop/locking, and eventual game-over display. (The script uses deterministic piece selection.)

Interactive terminal input was not exercised manually; the input handler is implemented for arrow keys/WASD, space, and `q`.
