# Handoff

Task 1: `src/render.js` exports pure `renderFrame`, `WIDTH`, `HEIGHT`; `src/index.js` exports `start({ output, source, seed })` and runs it for the CLI. Task 2: `src/model.js` defines seven local-coordinate tetrominoes, centered top spawns, empty 10×20 initial state, and an injectable piece source. `createPieceSource(seed)` uses a replayable LCG; `reset()` restores its initial sequence. Without a seed, its initial state is random. A three-column piece is centered within half a cell on the even-width board. Active cells render as `<>`, settled cells as `[]`; board cells remain empty at spawn. Tests: `test/render.test.js`, `test/model.test.js`.

The launch path still emits one static frame and exits; gameplay, terminal sizing and lifecycle belong to later tasks. Renderer uses 22 board lines plus score and controls (24 total), no trailing newline. `.npmrc` silences npm banners for exact `npm start` capture.

Verification: `node --test test/model.test.js` for model focus; `npm test` for full suite; capture exact `npm start` for 24 rows and no final newline. PTY recipe: launch `npm start` in a 50×24 PTY and verify borders and last controls line without scrolling. No packages required. Displayed bindings are future controls, not yet wired.
