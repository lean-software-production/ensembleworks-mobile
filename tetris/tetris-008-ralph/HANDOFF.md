# Handoff

B04 / T04 adds `rotateClockwise(game)` in `src/model.js`, reusing `canPlace`. Rule: fixed local square, clockwise `(x,y) → (size−1−y,x)`; I uses size 4, T/S/Z/J/L size 3. Origin stays fixed, no kicks/normalization. O succeeds as a reference-preserving no-op. Invalid placements, paused/game-over states and missing active pieces return false without mutation. Shared shape definitions remain unchanged.

Initial target status had no interrupted source edits (only untracked harness metadata); unrelated workspace changes were untouched. No supplied findings or observed plan defects. Previous movement, source, palette and 24-row rendering contracts remain intact.

`test/rotation.test.js` checks exact direction/rule, four-turn restoration and four distinct cells for all types; enumerates legal placements across all orientations to exercise both walls/floor; blocks every non-square orientation with settled cells; verifies rejected state/reference preservation and inactive-state guards.

Verification: `node --test test/rotation.test.js` passes 4 tests. Final `npm test` passes 12 tests, including all prior tests and actual non-TTY `npm start` bounded-frame launch. Evidence mapped in `VERIFICATION.md`.

Remaining T05–T13: descent, lock/clear/score, game over/restart, gravity, key dispatch and terminal session. `src/main.js` still emits one initial frame then exits; keyboard rotation belongs to T11. Final batch must cover legal-gameplay production lifecycle, all seven colours interactively and actual npm-start PTY quit/termios restoration. No commits or downstream validation claimed.
