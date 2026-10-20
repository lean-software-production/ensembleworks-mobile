# Gravity and pause

`src/session.js` owns the sole gravity timer. `createSession(game, { clock, onChange })`
starts a fresh 1000 ms interval for a running game. Each tick calls the same
`descend` pipeline used for soft drop: move one row OR lock, clear, score and
spawn once. Chained timeouts skip catch-up falls when a callback is delayed.
The injectable clock supplies `setTimeout` and `clearTimeout`.

`dispatch` accepts left, right, rotate, down, pause, resume and restart. Pause
sets paused status and cancels gravity; model guards also freeze manual play.
Resume and successful game-over restart wait a full new interval. Game over
stops scheduling. Repeated resume/restart cannot add timers; stale cancelled
callbacks are ignored. `dispose()` permanently cancels scheduling and is
idempotent. The future terminal adapter owns disposal and must dispatch here,
not create another gravity loop. `onChange(game)` requests a redraw after each
tick or dispatch; rendering itself never advances play.

The reserved status/control rows display pause and advertise p pause/resume.
Key decoding and interactive startup are intentionally deferred to T11/T12;
`npm start` still emits one bounded preview and exits.
