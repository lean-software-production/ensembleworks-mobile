# Handoff

B02 / T02 adds initial pieces to the preserved B01 baseline. No interrupted target source edits, validator findings or plan defects were found; unrelated workspace changes remain untouched.

Sources: `src/model.js` owns dimensions, frozen seven-shape spawn geometry, independent 10×20 null boards, active coordinates, zero score and running status. `createGame(nextPiece)` consumes one injected type; `createPieceSource(random)` uses uniform independent selection (not a bag). `seededRandom(seed)` provides reproducible Mulberry32 values. Spawn x centers the occupied width, rounding left for odd spare columns; y is zero. Each active piece owns copied geometry.

`src/render.js` retains empty `renderFrame()` compatibility and optionally overlays game state without mutation/randomness. Plain cells use `[]`; optional ANSI uses seven distinct retro colours, reset per glyph, with styled borders/status. `src/main.js` creates a random initial game, enables colour only on TTY, emits one frame and exits. No interactive session exists yet. `.npmrc` keeps npm banners out of the 24-row budget.

Verification: `node --test test/model.test.js` (2 passed); final `npm test` (4 passed), including literal piped `npm start`. Tests cover all shapes, centered valid spawns, independent rows/geometry, deterministic source coverage, renderer purity, palette codes and untrimmed 24-row output. See `VERIFICATION.md`.

Remaining batches supply collision/movement, rotation, descent/locking, clears/score, game over/restart, scheduler, input and lifecycle. Final batch must verify all colours interactively, actual npm-start PTY/termios restoration and legal-gameplay production lifecycle. No commits or downstream validation claimed.
