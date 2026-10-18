# Task 6 verification

`src/model.js` already implements `lockPiece` and `advanceDown`; this attempt preserved that behavior and tightened `test/model.test.js` assertions for exact settled coordinates, idempotent locking without an active piece, unchanged spawn coordinates, and no extra draw on the subsequent legal step.

- `node --test test/model.test.js`: 13 passed, 0 failed.
- `npm test`: 16 passed, 0 failed.

Line clearing and scoring are reserved for tasks 7 and 8. The static launch adapter is reserved for later session tasks.
