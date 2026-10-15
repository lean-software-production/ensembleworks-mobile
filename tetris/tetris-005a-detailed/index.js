"use strict";

const { createLiveGame } = require("./src/app");
const { renderFrame } = require("./src/frame");
const { createPieceSource } = require("./src/game");
const { createTerminalSession } = require("./src/terminal");

// CI, pipes, and redirected output receive one readable frame and terminate.
if (!process.stdin.isTTY || !process.stdout.isTTY) {
  process.stdout.write(`${renderFrame()}\n`);
} else {
  let app;
  const terminal = createTerminalSession({
    input: process.stdin,
    output: process.stdout,
    onTerminate() { app?.quit(); }
  });

  app = createLiveGame({
    input: process.stdin,
    output: process.stdout,
    pieceSource: createPieceSource(),
    onQuit() {
      terminal.cleanup();
      process.exit(0);
    },
    onError(error) {
      terminal.cleanup();
      process.stderr.write(`Tetris stopped: ${error.message}\n`);
      process.exitCode = 1;
    }
  });

  try {
    terminal.start(() => app.start());
  } catch (error) {
    terminal.cleanup();
    process.stderr.write(`Tetris stopped: ${error.message}\n`);
    process.exitCode = 1;
  }
}
