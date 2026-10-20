# Handoff

B12/T12 implemented in `src/main.js`: in-place home/clear redraw, dimension-aware warnings and resize recovery; one idempotent teardown for quit, signals, stream end/errors and guarded input/timer/render failures. Restores prior raw mode and cursor, pauses stdin, removes listeners and disposes the sole gravity scheduler. Non-TTY remains one plain frame without listeners/timers.

`src/render.js` exports measured minimum 63×24: running controls are 63 columns, not the prior handoff's 60. Warning truncates to available width minus one; zero dimensions emit no visible text. Frame/palette/gameplay rules unchanged.

`test/terminal.test.js` checks bounds/redraw/resize, tiny dimensions, signals, stream failures, scheduled callback failure and idempotent cleanup. Focused `node --test test/terminal.test.js test/input.test.js` passed 7/7; final `npm test` passed 51/51 after code changes. `VERIFICATION.md` maps R01–R12 evidence.

Actual npm start PTY recipe: openpty, TIOCSWINSZ 80×24, launch npm with slave streams/new process session, send down/pause, resize 8×3 then 80×24 with SIGWINCH, exit q or group SIGTERM. Both verified warning/cursor and exact before/after termios equality (4100 bytes each); quit exit 0, SIGTERM npm exit -15. Initial PTY caught live stdin after quit; unconditional pause fixed it.

No observed plan defects; no commits or downstream validation performed. Remaining T13: concise project documentation, legal production fall/lock/clear/score/game-over/restart/quit regression and interactive all-seven-colour evidence. SIGKILL cannot restore terminal state. Prior batches/unrelated workspace work preserved.
