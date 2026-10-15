# Verification

- `npm test` — passed; output: `Gameplay tests passed`.
- `npm start | wc -l` — returned `24`.
- `npm start | awk '{ print NR, length($0), $0 }'` — passed; displayed all 24 startup rows, including score, bordered board, and controls. The npm startup banner is suppressed by `.npmrc` (`loglevel=silent`).

Interactive terminal input was not exercised manually. The input handler supports arrow keys/WASD, space, and `q`.
