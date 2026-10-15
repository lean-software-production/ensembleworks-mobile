"use strict";

const { FRAME_MIN_COLUMNS, FRAME_ROWS, renderFrame, renderSizeWarning } = require("./frame");
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

class KeyDecoder {
  constructor() { this.pending = ""; }

  push(input) {
    this.pending += Buffer.isBuffer(input) ? input.toString("utf8") : String(input);
    const actions = [];
    while (this.pending.length > 0) {
      if (this.pending[0] === "\x1b") {
        if (this.pending.length === 1) break;
        if (this.pending[1] !== "[") {
          this.pending = this.pending.slice(1);
          continue;
        }
        if (this.pending.length < 3) break;
        const arrow = {
          "\x1b[A": "rotate", "\x1b[B": "down", "\x1b[C": "right", "\x1b[D": "left"
        }[this.pending.slice(0, 3)];
        if (arrow) {
          actions.push(arrow);
          this.pending = this.pending.slice(3);
        } else {
          this.pending = this.pending.slice(1);
        }
        continue;
      }
      const key = this.pending[0];
      this.pending = this.pending.slice(1);
      const action = { " ": "drop", q: "quit", Q: "quit", "\x03": "quit" }[key];
      if (action) actions.push(action);
    }
    return actions;
  }
}

/**
 * Attach terminal I/O to the pure game engine. A small terminal pauses the
 * game: no input or gravity is applied, and resuming clears gravityElapsed so
 * time spent resizing can never become a delayed drop.
 */
function createLiveGame({
  input,
  output,
  pieceSource,
  game = createGame({ pieceSource }),
  timers = { setInterval, clearInterval },
  sizeEmitter = output,
  getSize = () => ({ rows: output.rows ?? FRAME_ROWS, columns: output.columns ?? FRAME_MIN_COLUMNS }),
  onQuit = () => {},
  onError = () => {}
} = {}) {
  if (!input?.on || !input?.removeListener || !output?.write) {
    throw new TypeError("input and output must be event-capable terminal streams");
  }
  if (!timers?.setInterval || !timers?.clearInterval) throw new TypeError("timers must provide setInterval and clearInterval");
  if (typeof pieceSource !== "function") throw new TypeError("pieceSource must be a function");

  let current = game;
  let timer = null;
  let exited = false;
  let paused = false;
  const decoder = new KeyDecoder();

  function terminalFits() {
    const { rows, columns } = getSize() || {};
    return Number(rows) >= FRAME_ROWS && Number(columns) >= FRAME_MIN_COLUMNS;
  }

  function draw() {
    const size = getSize() || {};
    const frame = terminalFits()
      ? renderFrame({ board: current.board, activePiece: current.active, score: current.score, gameOver: current.gameOver })
      : renderSizeWarning(size);
    output.write(`\x1b[2J\x1b[H${frame}`);
  }

  function stop() {
    exited = true;
    input.removeListener("data", onData);
    sizeEmitter?.removeListener?.("resize", onResize);
    if (timer !== null) { timers.clearInterval(timer); timer = null; }
  }

  function fail(error) {
    if (exited) return;
    stop();
    onError(error);
  }

  function dispatch(action) {
    if (exited) return;
    if (action === "quit") { quit(); return; }
    if (paused) return;
    try {
      switch (action) {
        case "left": current = moveLeft(current); break;
        case "right": current = moveRight(current); break;
        case "rotate": current = rotateClockwise(current); break;
        case "down": current = moveDown(current, pieceSource); break;
        case "drop": current = hardDrop(current, pieceSource); break;
        default: return;
      }
      draw();
    } catch (error) { fail(error); }
  }

  function onData(data) {
    for (const action of decoder.push(data)) dispatch(action);
  }

  function tick() {
    if (exited || paused) return;
    try {
      current = advanceGravity(current, GRAVITY_INTERVAL_MS, pieceSource);
      draw();
    } catch (error) { fail(error); }
  }

  function onResize() {
    if (exited) return;
    const fits = terminalFits();
    if (paused && fits) current = { ...current, gravityElapsed: 0 };
    paused = !fits;
    try { draw(); } catch (error) { fail(error); }
  }

  function start() {
    if (exited || timer !== null) return;
    input.on("data", onData);
    sizeEmitter?.on?.("resize", onResize);
    paused = !terminalFits();
    timer = timers.setInterval(tick, GRAVITY_INTERVAL_MS);
    try { draw(); } catch (error) { fail(error); }
  }

  function quit() {
    if (exited) return;
    stop();
    onQuit();
  }

  return {
    start, quit, dispatch,
    get game() { return current; },
    get exited() { return exited; },
    get paused() { return paused; }
  };
}

module.exports = { KeyDecoder, createLiveGame };
