# Verification

- `node --check tetris.js` — passed (exit 0).
- `npm test` — attempted; unavailable because `package.json` defines no `test` script (exit 1).
- `npm start` — attempted; exited with code 1 and printed `Tetris requires an interactive terminal.` This environment has no interactive terminal, so controls, gameplay, and the full rendered display height could not be verified. No interactive/manual checks are claimed.
