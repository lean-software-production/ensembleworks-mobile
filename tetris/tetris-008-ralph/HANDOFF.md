# Handoff

B08 / T08 adds frozen `LINE_POINTS = [0,100,300,500,800]` in `src/model.js`. `descend` now locks → compacts → scores once → selects/attempts spawn. Ordinary movement and the standalone settling primitive do not score. Blocked spawn still leaves active null and is explicitly reported pending T09. Initial score remains zero.

`src/render.js` displays live totals in the reserved row; strings over 15 characters abbreviate to 14 characters plus ellipsis (22-column label). Stored scores are unchanged. `SCORING.md` documents points, ordering, display abbreviation and JavaScript number precision limits.

`test/scoring.test.js` uses focused model fixtures for composed 0–4-line awards, source-observed ordering, accumulation, no awards for movement/rejection/rotation/zero clears, and large-score plain/ANSI frame bounds. `test/clearing.test.js` updates prior zero-score expectations to earned awards, retaining all compaction coverage. These are not final production lifecycle fixtures.

Verification recipes: `node --test test/scoring.test.js test/clearing.test.js` passed 15 tests; final `npm test` passed 36, including actual bounded non-TTY `npm start`, 24-row frames and palette regressions. `VERIFICATION.md` maps R01–R08 evidence.

No interrupted target source work, supplied findings or observed plan defects. Unrelated workspace edits and harness metadata untouched. No commits/downstream validation performed.

Remaining T09–T13: game-over/restart, scheduler/input/session lifetime, complete launch documentation and legal-gameplay production regression. Final delivery still needs actual npm-start PTY quit/termios checks and interactive seven-colour observation. Current entry point emits one bounded frame and exits. Original `createGame` objects retain injected sources in a WeakMap; snapshots are inspection data, not playable copies.
