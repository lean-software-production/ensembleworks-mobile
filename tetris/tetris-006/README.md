# Terminal Tetris

Run the game with `npm start` and its automated checks with `npm test`.

## Scoring

A score starts at zero. Points are awarded only when a falling piece locks and
clears lines: 0 lines = 0 points, 1 = 100, 2 = 300, 3 = 500, and 4 = 800.
Scores accumulate across locks. Moving, failed movement, and rotation do not
award points. The live score is shown in the fixed status row below the board.
