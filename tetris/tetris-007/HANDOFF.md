# Handoff

`src/model.js` owns shapes, spawning, placement, movement, rotation, downward steps, and locking. Task 7 adds pure `clearFullRows(board)`, returning `{ board, clearedRows }`: full rows disappear simultaneously, survivors retain order, and independent empty rows pad the top. Input rows are not mutated or aliased.

`lockPiece` validates a grounded running piece and obtains a valid next type before mutation, settles four cells, compacts, then checks next spawn. Lock/descend results now include `clearedRows` (zero for non-lock actions). Invalid lock requests do not clear rows. Score remains unchanged pending task 8. A blocked spawn still leaves active null with running status and explicit `spawnBlocked`; task 9 owns game over. Pass the same injected type source across actions.

`test/clearing.test.js` covers zero through four simultaneous clears, nonadjacent rows, ordering, padding, dimensions, input independence, lock-completes-row, no-op locks, and clearing top obstruction before spawn. `test/locking.test.js` retains locking and source atomicity checks with the extended event shape.

Verified after final code/test edits:
- `node --test test/clearing.test.js test/locking.test.js`: 26 passed.
- `npm test`: 83 passed, including bounded renderer checks.

`src/main.js` still renders once and exits; scheduling, input, and terminal lifecycle remain later tasks. No PTY gameplay check is claimed. Bounded capture uses `node src/main.js` or `npm start --silent` to avoid npm banners.
