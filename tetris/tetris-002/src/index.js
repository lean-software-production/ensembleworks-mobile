'use strict';

const { Board } = require('./board');
const { Game } = require('./game');
const { TerminalInput } = require('./input');
const { PieceSource } = require('./pieces');
const { TerminalRenderer } = require('./renderer');

function createGame({ input = process.stdin, output = process.stdout, random = Math.random } = {}) {
  return new Game({
    board: new Board(),
    pieces: new PieceSource(random),
    input: new TerminalInput(input),
    renderer: new TerminalRenderer(output),
    onQuit: () => { process.exitCode = 0; }
  });
}

function main() {
  createGame().start();
}

if (require.main === module) {
  main();
}

module.exports = { createGame, main };
