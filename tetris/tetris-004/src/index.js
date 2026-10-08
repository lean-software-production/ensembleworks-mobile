'use strict';

const { TetrisGame } = require('./game');

// Rendering and input are attached in later tasks; create the game here so the
// executable always starts with a complete game state.
const game = new TetrisGame();

if (require.main === module) {
  process.stdout.write(`Terminal Tetris is ready (${game.width}x${game.height} board).\n`);
}

module.exports = { TetrisGame, game };
