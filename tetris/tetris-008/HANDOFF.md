# Handoff

`src/model.js` owns the 10×20 model, seven shapes, seeded/injected piece generation, placement, no-kick rotation, `stepDown`, `lockPiece`, `clearCompletedRows`, and `advanceDown`. On a blocked downward action, it locks once, compacts all full rows simultaneously, reports `cleared`, draws one next type, and tests spawn against the compacted board. Compaction copies survivors in order and inserts empty rows above them without mutating the input. Spawn obstruction retains the settled board and returns `status: 'over'` with no active piece. Scoring is not implemented yet (task 8).

Model checks: `test/model.test.js` covers zero through four clears, nonadjacent rows, unchanged input, and lock/clear/spawn order. Focused recipe: `node --test test/model.test.js`; full suite: `npm test`. `src/render.js` and `test/render.test.js` cover the pure bounded frame. `src/index.js` exports `start({ output, source, seed })` and currently emits one static frame. Frame capture: `npm start` (silent via `.npmrc`), split on newlines; no final newline. PTY recipe: run `npm start` in a 50×24 PTY and inspect the last controls line without scrolling.

Displayed bindings are not yet wired. Terminal sizing and raw-mode cleanup remain for later tasks. Do not score in the clearing primitive; task 8 owns points updates.
