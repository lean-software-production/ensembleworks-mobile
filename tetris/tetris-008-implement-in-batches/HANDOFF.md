# B02 handoff

Implemented T06–T09 in `src/model.js`: `lockPiece` consumes active cells once; `advance` moves OR locks→clears→scores→spawns; `clearLines` preserves survivor order. Scores 0/100/300/500/800 for 0–4 lines. Blocked spawn sets `game-over`, active=null, without overwriting settled cells. Gameplay becomes inert. `restart` resets the same state and consumes the next source piece, without rewinding. Sources live in a WeakMap; cloned fixtures must pass an explicit source to progression/restart.

`src/render.js` preserves seven colours and exact 24 rows; game-over and restart model guidance replace existing status text. Scores longer than 16 characters are abbreviated. Launch remains a noninteractive snapshot with truthful `no keys` guidance. README documents APIs and choices.

Verification: `node --test test/lifecycle.test.js` 8/8; full `npm test` 14/14 after final code changes. Actual `npm start --silent` plain capture: 24 rows, max 40 columns, no ANSI. Requirement/check mapping is in `VERIFICATION.md`; B01 regressions retained. No interrupted target work or plan defects found; unrelated workspace changes untouched.

B03 recipe in `test/lifecycle.test.js`: inject constant O source; move each of five pieces to x=0,2,4,6,8 and descend/advance to clear two lines (300). Ten subsequent central O locks cause game over; restart resets. All transitions are legal gameplay; carry this into actual production-entry integration, not direct board edits.

Remaining: T10–T13 scheduler/pause, input, terminal ownership/resize/cleanup, production lifecycle regression, actual npm-start PTY quit/termios checks and interactive seven-colour verification. No validation or commit claimed.
