# Handoff

B01 / T01 implements the empty-board launch baseline only. Target initially contained only `.assembly-lines` metadata; no previous application or HANDOFF existed. Unrelated workspace changes were left untouched. No plan defects or validator findings were supplied/found.

Sources: `src/render.js` exports pure `renderFrame()` and board/frame dimensions; `src/main.js` writes one frame then exits. The frame uses 20 rows of ten two-space cells, two borders, score and controls: exactly 24 rows, no trailing newline. Controls honestly indicate this is a noninteractive preview. `.npmrc` suppresses npm banners so literal `npm start` remains bounded. No dependencies are required (Node >=20).

Tests: `test/render.test.js` checks exact board geometry, borders, status, purity, newline budget and actual `npm start` subprocess output/exit. Run `npm test`; manually capture `npm start > /tmp/tetris-frame.txt` and count split-newline rows without trimming. Evidence is in `VERIFICATION.md`.

Remaining: later selected batches add pieces/palette, model actions, locking/clears/scoring, game over/restart, gravity, input and terminal lifetime, then legal-gameplay production lifecycle and actual PTY/termios checks. No interactive terminal behavior is claimed at this baseline. Preserve frame budget and plain piped output while extending rendering.
