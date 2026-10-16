# Plan

- [x] Implement terminal Tetris runnable with `npm start`, including falling tetrominoes, movement and rotation, collision detection, line clearing, scoring, and game over.
  - [x] Add retained deterministic engine tests for movement, rotation, locking, line clearing/scoring, and game-over behavior. (validator finding)
- [x] Add keyboard controls, clean terminal setup/exit handling, and a display that keeps the board, score, controls, borders, and game-over messages within 24 rows; document how to play.
  - [x] Preserve pending gravity ticks during movement and rotation; cover timing, level changes, game over, and restart deterministically. (validator finding)
  - [x] Clear every rendered terminal row; cover live, game-over, and restart frames within the 24-row limit. (validator finding)
- [x] Add automated gameplay and display-size checks, run startup and interactive smoke checks, and commit a verification report in the target recording checks performed and results.
