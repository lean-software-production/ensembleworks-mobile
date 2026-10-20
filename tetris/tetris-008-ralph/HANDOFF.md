# Handoff

B10 / T10 recovers the interrupted untracked `src/session.js` implementation and verifies it. `createSession` owns one chained 1000 ms timeout driving the existing composed `descend` pipeline. Inject clock/onChange for adapters/tests. Dispatch supports left/right/rotate/down/pause/resume/restart. Pause uses model status guards; game over cancels scheduling. Resume/restart wait a fresh interval; delayed ticks do not catch up. Generation tokens reject stale callbacks. Dispose is permanent and idempotent. Terminal adapters must own disposal, not another gravity loop. See `GRAVITY.md`.

`src/render.js` shows Paused in the reserved status row and advertises p pause/resume. Seven-piece palette and 24-row budget remain intact. `src/main.js` intentionally still emits one bounded preview; input/session wiring is T11 scope.

`test/session.test.js` exercises timing boundaries, lock/spawn, frozen manual/timed play, stale callbacks, delayed ticks, duplicate prevention, legal O stacking through game over, restart, disposal and plain/ANSI frame bounds. `test/model.test.js` updates the prior exact controls assertion.

Verification: focused `node --test test/session.test.js` passed 4. Final `npm test` passed 44, including literal non-TTY npm start. Initial full run exposed the stale controls assertion, now fixed. `VERIFICATION.md` maps R01–R10 evidence. No supplied findings or observed plan defects; unrelated workspace changes untouched. No commits or downstream validation performed.

Remaining T11–T13: keyboard adapter, terminal lifecycle, actual npm-start PTY quit/termios and interactive colour evidence, legal-gameplay production lifecycle regression and final launch documentation.
