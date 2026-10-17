# Handoff

`src/model.js` owns collision-safe gameplay, lock → simultaneous clear → score → spawn/game over, restart, and now `togglePause`. All gameplay actions reject paused/game-over states; restart only accepts game over. Keep the same injected type source across restarts.

`src/session.js` owns serialized intent dispatch and injectable `clock.setTimeout/clearTimeout`, with fixed 1000 ms gravity. Creation schedules one full interval; every tick performs exactly one `descend`. Lock, resume, and restart re-arm a full interval; ordinary movement/rotation/soft steps preserve deadlines. Generation tokens invalidate stale callbacks. Game over, pause, suspension and idempotent stop cancel timers. `setSuspended` preserves model status for future terminal sizing support. `onChange(state, result)` receives one action result; terminal adapters must not repeat its lock/scoring event. Session creation does not emit an initial frame.

`src/render.js` renders running, paused (P:resume), and game-over controls in the same 24 rows, at most 40 visible columns, without trailing newline.

Verification after final code/test changes:
- `node --test test/session.test.js`: 8 passed (fake-clock boundaries, stale callbacks, pause, restart, game over, suspension, stop, frame bounds).
- `npm test`: 105 passed, including existing model/renderer and bounded entry-point capture tests.

`src/main.js` still renders once and exits. Keyboard decoding/dispatch and terminal lifecycle/composition remain tasks 11–13; actual playable PTY launch/restoration has not been checked. Bounded captures must use `node src/main.js` or `npm start --silent` to avoid npm banner rows. Test fixtures account for existing negative-zero spawn origins without changing geometry.
