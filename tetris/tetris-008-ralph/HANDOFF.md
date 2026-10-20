# Handoff

B06 / T06 adds `lockPiece(game)` and `descend(game)` in `src/model.js`. Separate locking copies four valid active cells into the existing board and sets active null, consuming no randomness. Composed descent returns `{kind:'moved'}`, `{kind:'ignored'}`, or `{kind:'locked',spawnBlocked}`. A blocked step locks once, consumes one next piece and attempts centered spawn without advancing it. Blocked spawn leaves active null and reports explicitly; status resolution remains T09. Clearing/scoring must be inserted between lock and spawn in T07/T08.

Piece sources live in a WeakMap keyed by original `createGame` instances, keeping state serializable and preserving prior snapshot tests. Cloned snapshots are inspection data, not playable instances. Existing movement, rotation, descent, renderer and seven-colour palette remain unchanged.

`test/locking.test.js` covers exact four-cell writes for all seven types, unrelated-cell preservation, once-only locks/source consumption, move-only actions, floor/settled obstructions, untouched new spawn, blocked spawn, and invalid/unavailable states.

Verification: focused `node --test test/locking.test.js` passed 5 tests; final `npm test` passed 21, including actual bounded non-TTY `npm start`. `VERIFICATION.md` maps R01–R06 evidence.

Initial target had no interrupted source changes; unrelated workspace edits and harness metadata were untouched. No supplied findings or observed plan defects. No commits or downstream validation claimed.

Remaining T07–T13: clear/score, game-over/restart, scheduler/input/session lifecycle, documentation and full production legal-gameplay regression. Final delivery still requires actual npm-start PTY quit/termios restoration and interactive seven-colour observation. Current entry point emits one bounded frame and exits.
