# Handoff

`src/model.js` owns the 10×20 board, seven shapes, seeded/injected source, placement, no-kick rotation, downward stepping, locking, simultaneous clearing and scoring (0/100/300/500/800). `advanceDown` locks only on blocked descent, clears and scores before drawing and testing one spawn. A blocked spawn preserves settled cells, sets `status: 'over'`, and removes the active piece. Over-state movement, rotation and downward actions are inert. `restartGame(over, source)` resets the source when it provides `reset()` (seeded sources do), then creates an empty running game with zero score; restart in other states is inert.

`src/render.js` uses 22 board lines and two status lines; game over replaces controls with `R: restart` and `Q: quit` without adding rows. `test/model.test.js` covers blocked/unblocked spawn, a clear freeing spawn space, over-state inertia, seeded restart, and bounded frames. `test/render.test.js` checks empty frames and non-TTY launch.

Verification: `node --test test/model.test.js`; `npm test`; `npm start` captures a non-TTY frame with no trailing newline (silent via `.npmrc`). PTY recipe: launch `npm start` in a 50×24 PTY and inspect the final controls line without scrolling. `src/index.js` still emits one static frame; interactive sizing, gravity, keyboard input, raw mode and teardown remain for later tasks.
