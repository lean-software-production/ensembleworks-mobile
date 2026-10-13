'use strict';

const { TetrisGame } = require('./game');

// The terminal renderer and input loop are added separately; creating a game here
// keeps `npm start` runnable while exposing the complete gameplay engine.
const game = new TetrisGame();
console.log(`Tetris game ready: ${game.width}x${game.height} board, first piece ${game.current.type}.`);
