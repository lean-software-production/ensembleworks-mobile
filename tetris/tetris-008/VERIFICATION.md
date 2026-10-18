# Task 7 verification

`src/model.js` clears complete rows after locking and before testing the next spawn, returning the clear count. `test/model.test.js` checks zero through four simultaneous clears (including nonadjacent rows), survivor order, top padding, dimensions, input immutability, and a blocked downward action completing a row and spawning once.

- `node --test test/model.test.js`: 15 passed, 0 failed.
- `npm test`: 18 passed, 0 failed.
- `git diff --check -- src/model.js test/model.test.js HANDOFF.md VERIFICATION.md`: clean.

Scoring remains task 8; terminal session work remains later tasks.
