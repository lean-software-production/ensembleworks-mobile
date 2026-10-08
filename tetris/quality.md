# Tetris code quality

Improve the quality of the existing terminal Tetris game without changing how
it plays. Add no gameplay, controls or display features.

Bring the code to the goal the metrics machine's report states: every function
within its CRAP limit, test coverage at or above its minimum, and passing
automated tests run with:

    npm test

Use Node's built-in test runner; add no dependencies for testing.

The game still starts with `npm start` and keeps its complete display within 24
terminal rows.
