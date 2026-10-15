'use strict';

const { renderFrame } = require('./render');
const { createGame } = require('./game');
const { createGravityController } = require('./gravity');
const { createInputAdapter } = require('./input');

function writeFrame(output, game) {
  output.write(`${renderFrame(game)}\n`);
}

/** Start a playable keyboard session when stdin is a terminal. */
function startInteractiveSession({ input = process.stdin, output = process.stdout } = {}) {
  const game = createGame();
  const gravity = createGravityController(game);
  const redraw = () => writeFrame(output, game);
  const adapter = createInputAdapter(game, gravity, {
    onChange: redraw,
    onQuit: () => {
      gravity.stop();
      input.pause();
    },
  });

  redraw();
  input.setRawMode(true);
  input.resume();
  input.on('data', adapter.write);
  gravity.start();
  return { game, gravity, adapter };
}

function main() {
  // Captured/non-interactive launches produce one bounded frame and exit.
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    writeFrame(process.stdout, createGame());
    return;
  }
  startInteractiveSession();
}

if (require.main === module) main();

module.exports = { main, startInteractiveSession };
