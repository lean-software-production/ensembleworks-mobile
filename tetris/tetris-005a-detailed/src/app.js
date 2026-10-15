"use strict";

const { renderFrame } = require("./frame");
const {
  GRAVITY_INTERVAL_MS,
  advanceGravity,
  createGame,
  hardDrop,
  moveDown,
  moveLeft,
  moveRight,
  rotateClockwise
} = require("./game");

/**
 * Decode terminal input independently of the game. Arrow escape sequences may
 * arrive split across data events, while several keys may arrive in one event.
 */
class KeyDecoder {
  constructor() {
    this.pending = "";
  }

  push(input) {
    this.pending += Buffer.isBuffer(input) ? input.toString("utf8") : String(input);
    const actions = [];
    while (this.pending.length > 0) {
      if (this.pending[0] === "\x1b") {
        if (this.pending.length === 1) break;
        // Only CSI arrows need a third byte. A different following byte makes
        // this an unsupported escape key, not a partial arrow sequence.
        if (this.pending[1] !== "[") {
          this.pending = this.pending.slice(1);
          continue;
        }
        if (this.pending.length < 3) break;
        const sequence = this.pending.slice(0, 3);
        const arrow = {
          "\x1b[A": "rotate",
          "\x1b[B": "down",
          "\x1b[C": "right",
          "\x1b[D": "left"
        }[sequence];
        if (arrow) {
          actions.push(arrow);
          this.pending = this.pending.slice(3);
        } else {
          // An unsupported escape prefix is harmless; consume it and continue
          // so following ordinary keys are still recognized.
          this.pending = this.pending.slice(1);
        }
        continue;
      }

      const key = this.pending[0];
      this.pending = this.pending.slice(1);
      const action = {
        " ": "drop",
        q: "quit",
        Q: "quit",
        "\x03": "quit"
      }[key];
      if (action) actions.push(action);
    }
    return actions;
  }
}

/**
 * Attach the impure terminal loop to the pure game engine. `timers` and I/O
 * are injectable so this adapter can be tested without a TTY or real time.
 */
function createLiveGame({
  input,
  output,
  pieceSource,
  game = createGame({ pieceSource }),
  timers = { setInterval, clearInterval },
  onQuit = () => {}
} = {}) {
  if (!input?.on || !input?.removeListener || !output?.write) {
    throw new TypeError("input and output must be event-capable terminal streams");
  }
  if (!timers?.setInterval || !timers?.clearInterval) {
    throw new TypeError("timers must provide setInterval and clearInterval");
  }
  if (typeof pieceSource !== "function") throw new TypeError("pieceSource must be a function");

  let current = game;
  let timer = null;
  let exited = false;
  const decoder = new KeyDecoder();

  function draw() {
    output.write(`\x1b[2J\x1b[H${renderFrame({
      board: current.board,
      activePiece: current.active,
      score: current.score,
      gameOver: current.gameOver
    })}`);
  }

  function dispatch(action) {
    if (exited) return;
    switch (action) {
      case "left": current = moveLeft(current); break;
      case "right": current = moveRight(current); break;
      case "rotate": current = rotateClockwise(current); break;
      case "down": current = moveDown(current, pieceSource); break;
      case "drop": current = hardDrop(current, pieceSource); break;
      case "quit": quit(); return;
      default: return;
    }
    draw();
  }

  function onData(data) {
    for (const action of decoder.push(data)) dispatch(action);
  }

  function tick() {
    if (exited) return;
    current = advanceGravity(current, GRAVITY_INTERVAL_MS, pieceSource);
    draw();
  }

  function start() {
    if (exited || timer !== null) return;
    input.on("data", onData);
    timer = timers.setInterval(tick, GRAVITY_INTERVAL_MS);
    draw();
  }

  function quit() {
    if (exited) return;
    exited = true;
    input.removeListener("data", onData);
    if (timer !== null) {
      timers.clearInterval(timer);
      timer = null;
    }
    onQuit();
  }

  return {
    start,
    quit,
    dispatch,
    get game() { return current; },
    get exited() { return exited; }
  };
}

module.exports = { KeyDecoder, createLiveGame };
