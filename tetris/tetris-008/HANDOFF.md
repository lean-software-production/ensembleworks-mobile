# Handoff

`src/model.js` owns the 10×20 model, seven shapes, seeded/injected source, placement, no-kick rotation, `stepDown`, locking, simultaneous row compaction, and `advanceDown`. A blocked downward action locks once, clears, adds the `LINE_POINTS` award (0/100/300/500/800 for 0–4 rows) once, draws one next type, then tests spawn against the compacted board. Other actions do not score. Spawn obstruction retains settled cells and returns `status: 'over'` with no active piece. The source resets to its sequence when seeded and `reset()` is called.

`src/render.js` renders the live model score on its reserved status line, with 22 board lines and one controls line. `test/model.test.js` covers clear counts, cumulative scoring, no-score actions, large-score frame bounds, lock/spawn ordering; `test/render.test.js` covers pure frames and non-TTY launch. Focused check: `node --test test/model.test.js`; full suite: `npm test`. Non-TTY capture: `npm start` (silent via `.npmrc`), split on newlines; no final newline. PTY recipe: run `npm start` in a 50×24 PTY and inspect last controls line without scrolling.

`src/index.js` exports `start({ output, source, seed })` and currently emits one static frame. Bindings are not wired yet; interactive terminal sizing, gravity, raw mode and cleanup remain for later tasks.
