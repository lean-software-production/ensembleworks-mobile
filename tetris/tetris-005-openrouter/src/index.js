'use strict';

const { TetrisGame } = require('./tetris');

// The terminal renderer and input loop build on this game engine in the next task.
const game = new TetrisGame();
console.log(`Tetris game engine ready (${game.width}x${game.height}); first piece: ${game.current.type}.`);
