# Handoff

Task 1 establishes the static display only. `src/render.js` exports `createEmptyState` (independent 10×20 empty rows) and pure `renderFrame`. `src/main.js` writes one frame and exits; `package.json` provides start/test scripts with no dependencies.

The retro-coloured frame uses 22 bordered-board rows plus score and controls rows. ANSI resets end each coloured segment; no trailing newline is emitted. Cells occupy two columns. Score text is visually truncated without changing state. Controls are a preview of later bindings, not yet functional.

Verification recipes:
- `node --test test/render.test.js` (focused)
- `npm test` (full suite; currently 4 tests)
- `npm start` (launch succeeds)
- `npm start --silent > /tmp/tetris-007-frame` (capture without npm banners); strip SGR ANSI sequences and split on newline: 24 rows, maximum width 35.

Tests cover independent rows, pure/repeatable rendering, full board/borders/status/controls, large-score bounds, colour resets, no trailing newline, and actual Node entry-point capture/exit.

No interactive PTY check has been performed: movement, quit, raw mode, scheduling and lifecycle are not implemented at this milestone. npm's ordinary banners are not part of the frame; use silent npm or the Node entry point for bounded capture. Future tasks must preserve all frame bounds and add interactive terminal ownership separately.
