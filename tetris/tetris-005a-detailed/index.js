"use strict";

const { createLiveGame } = require("./src/app");
const { renderFrame } = require("./src/frame");
const { createPieceSource } = require("./src/game");

// CI, pipes, and redirected output receive one readable frame and terminate.
// The live loop is deliberately enabled only when both streams are terminals.
if (!process.stdin.isTTY || !process.stdout.isTTY) {
  process.stdout.write(`${renderFrame()}\n`);
} else {
  let closed = false;

  function restoreTerminal() {
    if (closed) return;
    closed = true;
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write("\x1b[?25h\n");
  }

  const app = createLiveGame({
    input: process.stdin,
    output: process.stdout,
    pieceSource: createPieceSource(),
    onQuit() {
      restoreTerminal();
      process.exit(0);
    }
  });

  function quit() {
    app.quit();
  }

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.once("SIGINT", quit);
  process.once("SIGTERM", quit);
  process.stdout.write("\x1b[?25l");
  app.start();
}
