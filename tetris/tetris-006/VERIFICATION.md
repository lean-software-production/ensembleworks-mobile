# Verification

- `node --check tetris.js` — passed (exit 0).
- `npm test` — attempted; unavailable because `package.json` defines no `test` script (exit 1; npm reported `Missing script: "test"`).
- `npm start` — attempted; exited with code 1 and printed `Tetris requires an interactive terminal.` The available environment is non-interactive, so controls, gameplay, and the complete rendered display height could not be verified interactively. No interactive/manual checks are claimed.
