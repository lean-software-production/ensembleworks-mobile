# Tetris

Build a game of Tetris that runs in the terminal.

Start it with:

    npm start

Keep the complete game display within 24 terminal rows, including the board, score, controls, borders, and game-over messages.

You may install packages if they help you render or control the terminal display.

Use lots of retro ANSI colours: distinguish the seven tetromino types and style the border/status. Keep plain output readable, reset styles, and preserve the 24-row frame budget in every state.

For this matched cohort, plain non-TTY output is permitted. Retro colours are checked in the interactive terminal and all seven tetromino render cases. Production lifecycle integration fixtures must be reachable through legal gameplay, without direct edits to settled-board or active-piece state to force game over.
