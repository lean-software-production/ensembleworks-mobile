# Handoff

`src/model.js` owns seven shapes, seeded/injected piece generation, the 10×20 model, placement, movement, no-kick rotation, `stepDown`, `lockPiece`, and `advanceDown`. `stepDown(game)` returns `{ game, blocked }` without locking or drawing. `lockPiece(game)` copies four cells to a new board. `advanceDown(game, source)` steps when possible; on blockage it locks once, draws exactly one type, and tests the new spawn without moving it. An obstructed spawn returns `blockedSpawn: true`, `status: 'over'`, and no active piece, retaining settled cells. Clearing and scoring are not implemented yet; task 7 must insert clearing before spawn testing. Model checks are in `test/model.test.js`.

`src/render.js` is the pure 24-line frame renderer (`test/render.test.js`). `src/index.js` exports `start({ output, source, seed })` and currently emits one static frame on CLI launch. Run focused checks with `node --test test/model.test.js`; full suite with `npm test`. Frame capture: `npm start` (silent via `.npmrc`), split output on newlines and count at most 24 lines; no final newline. PTY recipe: run `npm start` in a 50×24 PTY and check the last controls line without scrolling. No dependencies required.

Displayed bindings are not wired yet. Terminal sizing and raw-mode cleanup are not implemented yet.
