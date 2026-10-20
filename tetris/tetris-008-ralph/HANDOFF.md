# Handoff

B09 / T09: `src/model.js` now sets `status: 'game-over'` when the post-clear/post-score next spawn is blocked; active remains null, preserving settled cells. Existing status guards reject gameplay after game over. `restartGame(game)` only restarts finished games, replaces board/score/active/status in place, and continues the existing injected piece source (no reseeding). Fresh state is built before reset. Original game objects retain their sources through the WeakMap; snapshots are inspection data, not playable copies.

`src/render.js` replaces the score row with game-over plus score and exposes r restart / q quit in the controls row; running advertises arrows / q. Both remain 24 rows, without a trailing newline. Bindings are not connected until T11. Seven-piece palette unchanged.

`test/game-over.test.js` covers blocked/unblocked spawn, clear-before-decision, frozen post-game actions, restart and plain/ANSI frame bounds. Existing clearing tests include a lock completing the spawn-opening row. Updated the old preview-controls assertion in `test/model.test.js`.

Verification: focused `node --test test/game-over.test.js test/locking.test.js` passed 9; final `npm test` passed 40 including literal non-TTY npm start. `VERIFICATION.md` maps R01–R09 evidence. No interrupted target edits, supplied findings or observed plan defects; unrelated workspace changes untouched. No commits or downstream validation performed.

Remaining T10–T13: scheduler/pause, keyboard/session lifecycle, launch documentation and legal-gameplay production lifecycle regression. Actual npm-start PTY quit/termios checks and interactive seven-colour evidence remain pending. Current entry emits one bounded frame and exits.
