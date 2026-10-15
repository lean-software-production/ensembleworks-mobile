# Verification

## Checks performed

- `npm test` — passed: 4 Node built-in test cases covering movement/rotation boundaries, hard drop/locking, line clearing/scoring, spawn collision game over, rendered board dimensions, and the 24-row display limit.
- `npm start < /dev/null` — passed (exit 0): the application started and reported `Tetris needs an interactive terminal.` as expected when no TTY is available.

## Limitations

- An interactive game session was not performed because this environment does not provide an interactive TTY. Keyboard input, raw-mode cleanup, and live rendering therefore could not be manually exercised.
