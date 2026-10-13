'use strict';

const { TetrisGame } = require('./tetris');
const { TerminalTetris, renderGame } = require('./terminal');

const game = new TetrisGame();

// A redirected start command remains useful in CI: show the complete display
// once rather than leaving a process waiting for keyboard input it cannot read.
if (!process.stdin.isTTY || !process.stdout.isTTY) {
  process.stdout.write(`${renderGame(game)}\n`);
} else {
  new TerminalTetris({ game }).start();
}
