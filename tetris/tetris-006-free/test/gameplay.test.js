const assert = require('node:assert/strict');
const { createGame, act, collides } = require('../src/index');

function sequence(...values) {
  let index = 0;
  return () => values[index++ % values.length];
}

// The first piece is a horizontal I; subsequent selections are fixed as well.
const game = createGame(sequence(0));
assert.equal(game.piece.shape.length, 1);
assert.equal(game.piece.shape[0].length, 4);

const startX = game.piece.x;
act(game, 'left');
assert.equal(game.piece.x, startX - 1);
for (let i = 0; i < 10; i++) act(game, 'left');
assert.equal(game.piece.x, 0);
assert.equal(collides(game, -1, game.piece.y), true);

const oldShape = game.piece.shape;
act(game, 'rotate');
assert.equal(game.piece.shape.length, 4);
assert.notEqual(game.piece.shape, oldShape);

act(game, 'drop', sequence(0));
assert.equal(game.board.flat().filter(Boolean).length, 4);
assert.equal(game.score, 0);
assert.equal(game.over, false);

// A bottom-up hard-drop sequence fills and clears a line, with score awarded.
const clearing = createGame(sequence(0));
clearing.board[19] = Array.from({ length: 10 }, (_, x) => x < 3 || x > 6 ? 1 : 0);
act(clearing, 'drop', sequence(0));
assert.equal(clearing.board[19].filter(Boolean).length, 0);
assert.equal(clearing.score, 100);

// A filled spawn area prevents a newly spawned piece from continuing.
const toppedOut = createGame(sequence(0));
toppedOut.board[0][4] = 1;
act(toppedOut, 'drop', sequence(0));
assert.equal(toppedOut.over, true);
assert.equal(toppedOut.board.length, 20);

console.log('Gameplay tests passed');
