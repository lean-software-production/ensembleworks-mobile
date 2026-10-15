# Verification

- `npm test` — passed (`Gameplay tests passed`).
- `npm start | awk '{ print NR, length($0), $0 }'` — passed; the complete non-TTY display is exactly 24 output rows, including score, borders, board, and controls.
- `npm start | wc -l` — returned `24`; the startup output does not include npm's lifecycle banner because `.npmrc` sets `loglevel=silent`.

Interactive terminal input was not exercised manually; the input handler is implemented for arrow keys/WASD, space, and `q`.
