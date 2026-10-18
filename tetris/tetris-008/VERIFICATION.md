# Task 12 findings and verification

- [x] Redirected input with small TTY output now uses the same dimension check as interactive redraw before writing a static frame; `test/session.test.js` checks 12×3, 50×2 and zero-size output without escapes, board overflow, timers or input listeners.

- [x] Redraw failures from input, timer and resize callbacks now trigger idempotent teardown before rethrowing; `test/session.test.js` injects each failure and checks raw mode, cursor, timer and listeners.
- [x] Raw mode restores its original value, even when enabling raw mode mutates state then throws; session tests cover both preexisting raw mode and partial startup failure.
- [x] Synchronous quit during input resume and synchronous output error during initial cursor-hide write abort startup without a late timer or attached listeners; session tests assert both paths.

`node --test test/session.test.js`: 13 passed. `npm test`: 42 passed. `npm start` in a 50×24 Python PTY displayed controls, exited 0 on `q`, and emitted cursor-show. `git diff --check -- src/index.js test/session.test.js HANDOFF.md VERIFICATION.md`: clean.

# Task 7 verification

`src/model.js` clears complete rows after locking and before testing the next spawn, returning the clear count. `test/model.test.js` checks zero through four simultaneous clears (including nonadjacent rows), survivor order, top padding, dimensions, input immutability, and a blocked downward action completing a row and spawning once.

- `node --test test/model.test.js`: 15 passed, 0 failed.
- `npm test`: 18 passed, 0 failed.
- `git diff --check -- src/model.js test/model.test.js HANDOFF.md VERIFICATION.md`: clean.

Scoring remains task 8; terminal session work remains later tasks.
