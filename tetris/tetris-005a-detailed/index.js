"use strict";

const { renderFrame } = require("./src/frame");

const frame = renderFrame();

// CI, pipes, and redirected output receive one readable frame and terminate.
// The live loop is intentionally enabled only when both streams are terminals.
if (!process.stdin.isTTY || !process.stdout.isTTY) {
  process.stdout.write(`${frame}\n`);
} else {
  let closed = false;

  function draw() {
    process.stdout.write(`\x1b[2J\x1b[H${frame}`);
  }

  function close() {
    if (closed) return;
    closed = true;
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write("\x1b[?25h\n");
  }

  function quit() {
    close();
    process.exit(0);
  }

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on("data", (input) => {
    if (input.equals(Buffer.from("q")) || input.equals(Buffer.from("Q")) || input.equals(Buffer.from([3]))) {
      quit();
    }
  });
  process.once("SIGINT", quit);
  process.once("SIGTERM", quit);
  process.stdout.write("\x1b[?25l");
  draw();
}
