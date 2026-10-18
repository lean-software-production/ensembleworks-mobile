# Handoff

`src/model.js` owns the 10×20 board, seven shapes, seeded/injected source, placement, no-kick rotation, downward stepping, locking, simultaneous clearing and scoring (0/100/300/500/800). `advanceDown` locks only on blocked descent, clears and scores before drawing and testing one spawn. A blocked spawn preserves settled cells, sets `status: 'over'`, and removes the active piece. Over-state movement, rotation and downward actions are inert. `restartGame(over, source)` resets the source when it provides `reset()` (seeded sources do), then creates an empty running game with zero score; restart in other states is inert.

`src/render.js` uses 22 board lines and two status lines; game over replaces controls with `R: restart` and `Q: quit`, pause with `P: resume` and `Q: quit`, without adding rows. `test/model.test.js` covers blocked/unblocked spawn, a clear freeing spawn space, over-state inertia, seeded restart, and bounded frames. `test/render.test.js` checks empty frames and non-TTY launch.

`src/gravity.js` owns one 1000 ms interval via an injected scheduler; `start`, `pause`, `resume`, `restart`, `stop` control it. It calls the model's `advanceDown`, stops on game over, and discards elapsed time on resume/restart. `test/gravity.test.js` uses a fake clock for ticks, lock, pause, over and restart. Session wiring is pending: `src/index.js` still emits one static frame; keyboard input, interactive sizing, raw mode and teardown remain for later tasks.

Verification: `node --test test/gravity.test.js`; `npm test`; `npm start` captures a non-TTY frame without trailing newline (silent via `.npmrc`). PTY recipe: launch `npm start` in a 50×24 PTY and inspect the final controls line without scrolling.
