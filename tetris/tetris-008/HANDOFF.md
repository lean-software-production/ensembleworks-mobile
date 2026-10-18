# Handoff

Task 1 source: `src/render.js` exports pure `renderFrame`, `WIDTH`, and `HEIGHT`; `src/index.js` exports `start({ output })` and runs it for the CLI. Tests: `test/render.test.js`.

The initial board is 10×20, empty, with doubled-width cells and 22 board lines plus score and controls (24 total). The launcher emits one static frame and exits even for non-TTY output; interactive gameplay, size handling, and terminal lifecycle belong to later tasks. The renderer and launcher emit no trailing newline, avoiding last-row scrolling in a 24-row PTY. Project `.npmrc` sets `loglevel=silent` so exact `npm start` prints no npm lifecycle banner. At 50 columns, the longest frame line fits.

Verification: `node --test test/render.test.js` for focused checks; `npm test` for the full suite; capture exact `npm start` (no `--silent`) for 24 rows and no final newline. For PTY smoke, run `npm start` in a 50×24 PTY and verify the top border and last controls line remain visible with no scrolling. No packages need installation.

Pitfall: the displayed bindings are future controls, not yet wired. Preserve the pure renderer and the injectable launch path as gameplay and session behavior are added.
