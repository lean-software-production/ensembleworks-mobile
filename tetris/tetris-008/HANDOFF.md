# Handoff

`src/model.js` owns seven shapes, seeded/injected piece generation, initial 10×20 board, `canPlace`, horizontal movement, no-kick clockwise rotation, and task-5 `stepDown(game)`. The latter returns `{ game, blocked }`: a legal step advances active `y` by one; rejection returns the identical game with `blocked: true`. It never locks, clears, scores or draws. It uses `canPlace` for floor and settled-cell collision. Model checks are in `test/model.test.js`; pure 24-line frame rendering is in `src/render.js`, checked in `test/render.test.js`. `src/index.js` exports `start({ output, source, seed })` and currently emits one static frame on CLI launch.

Run focused checks with `node --test test/model.test.js`; full suite with `npm test`. For a frame capture, run `npm start` (silent npm via `.npmrc`), split output on newlines and count at most 24 lines; there is no final newline. PTY recipe: run `npm start` in a 50×24 PTY and check the last controls line without scrolling. No dependencies required.

Future tasks must connect downward blockage to locking/clearing/spawning, then timer/input/session lifecycle. Displayed bindings are not yet wired. Terminal sizing and raw-mode cleanup are not yet implemented.
