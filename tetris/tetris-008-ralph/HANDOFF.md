# Handoff

B07 / T07 adds `clearLines(board)` in `src/model.js`: stable compaction, count return, independent empty top rows and preserved board identity. `descend(game)` now locks → clears → consumes/attempts spawn and returns `{kind:'locked', cleared, spawnBlocked}`. Moved/ignored results are unchanged. Insert T08 scoring after compaction and before spawn; no scoring was added here. Blocked spawn still leaves active null, explicitly reported pending T09.

`test/clearing.test.js` covers counts 0–4, nonadjacent rows, survivor order/content, independent top rows, dimensions, repeat clearing, and composed one-/two-row completions. The injected next-piece source checks that compaction already happened. A focused top-row lock fixture verifies clearing opens spawn space before placement. These are unit fixtures, not final production-lifecycle fixtures. `test/locking.test.js` retains R06 coverage with the extended result shape.

Verification: `node --test test/clearing.test.js test/locking.test.js` passed 13 tests; final `npm test` passed 29, including bounded actual non-TTY `npm start`, 24-row rendering and palette checks. `VERIFICATION.md` maps R01–R07 evidence.

Original `createGame` instances retain injectable sources in a WeakMap; snapshots are not independent playable games. Renderer, seven-colour palette and prior movement semantics are unchanged. No interrupted target source work, supplied findings or observed plan defects. Unrelated workspace edits and harness metadata untouched. No commits/downstream validation performed.

Remaining T08–T13: scoring, game-over/restart, scheduler/input/session lifecycle, documentation and legal-gameplay production regression. Final delivery still needs actual npm-start PTY quit/termios checks and interactive seven-colour observation. Current entry point emits one bounded frame and exits.
