'use strict';

const { BOARD_HEIGHT, BOARD_WIDTH, renderFrame } = require('./render');
const { createGame } = require('./game');
const { createGravityController } = require('./gravity');
const { createInputAdapter } = require('./input');

const MIN_COLUMNS = BOARD_WIDTH * 2 + 2;
const MIN_ROWS = BOARD_HEIGHT + 4;
const REDRAW_PREFIX = '\u001b[H\u001b[2J';
const HIDE_CURSOR = '\u001b[?25l';
const SHOW_CURSOR = '\u001b[?25h';

function writeFrame(output, game) {
  output.write(`${renderFrame(game)}\n`);
}

function terminalSize(output) {
  return {
    columns: Number.isInteger(output.columns) ? output.columns : 80,
    rows: Number.isInteger(output.rows) ? output.rows : MIN_ROWS,
  };
}

function fitsGame(output) {
  const { columns, rows } = terminalSize(output);
  return columns >= MIN_COLUMNS && rows >= MIN_ROWS;
}

function tooSmallFrame(output) {
  const { columns, rows } = terminalSize(output);
  if (columns <= 0 || rows <= 0) return '';
  return `Terminal too small; need ${MIN_COLUMNS} columns x ${MIN_ROWS} rows.`.slice(0, columns);
}

function addListener(emitter, event, listener) {
  if (emitter && typeof emitter.on === 'function') emitter.on(event, listener);
}

function removeListener(emitter, event, listener) {
  if (emitter && typeof emitter.removeListener === 'function') emitter.removeListener(event, listener);
}

/**
 * Start an interactive terminal session. Frames are painted from the terminal
 * home position, never appended. The returned cleanup method is idempotent,
 * so quit, signals, and handled failures share the same terminal restoration.
 */
function startInteractiveSession({
  input = process.stdin,
  output = process.stdout,
  scheduler,
  processObject = process,
} = {}) {
  const game = createGame();
  let cleanedUp = false;
  let rawModeEnabled = false;
  let onData;

  const redraw = () => {
    if (cleanedUp) return;
    const frame = fitsGame(output) ? renderFrame(game) : tooSmallFrame(output);
    output.write(`${REDRAW_PREFIX}${frame}`);
  };
  const gravity = createGravityController(game, {
    ...(scheduler ? { scheduler } : {}),
    onTick: redraw,
  });

  const cleanup = () => {
    if (cleanedUp) return false;
    cleanedUp = true;
    gravity.stop();
    removeListener(input, 'data', onData);
    removeListener(output, 'resize', onResize);
    removeListener(processObject, 'SIGINT', onInterrupt);
    removeListener(processObject, 'SIGTERM', onInterrupt);
    removeListener(processObject, 'uncaughtException', onFailure);
    if (rawModeEnabled && typeof input.setRawMode === 'function') input.setRawMode(false);
    if (typeof input.pause === 'function') input.pause();
    output.write(SHOW_CURSOR);
    return true;
  };
  const onResize = () => {
    redraw();
    if (fitsGame(output) && !game.paused && !game.gameOver) gravity.start();
    else gravity.stop();
  };
  const onInterrupt = () => {
    cleanup();
    if (processObject) processObject.exitCode = 130;
  };
  const onFailure = () => {
    cleanup();
    if (processObject) processObject.exitCode = 1;
  };
  const adapter = createInputAdapter(game, gravity, { onChange: redraw, onQuit: cleanup });
  onData = adapter.write;

  try {
    output.write(HIDE_CURSOR);
    redraw();
    if (typeof input.setRawMode === 'function') {
      input.setRawMode(true);
      rawModeEnabled = true;
    }
    if (typeof input.resume === 'function') input.resume();
    addListener(input, 'data', onData);
    addListener(output, 'resize', onResize);
    addListener(processObject, 'SIGINT', onInterrupt);
    addListener(processObject, 'SIGTERM', onInterrupt);
    addListener(processObject, 'uncaughtException', onFailure);
    if (fitsGame(output)) gravity.start();
  } catch (error) {
    cleanup();
    throw error;
  }

  return {
    game, gravity, adapter, redraw, cleanup,
    get closed() { return cleanedUp; },
  };
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

module.exports = {
  HIDE_CURSOR,
  MIN_COLUMNS,
  MIN_ROWS,
  REDRAW_PREFIX,
  SHOW_CURSOR,
  fitsGame,
  main,
  startInteractiveSession,
  terminalSize,
  tooSmallFrame,
  writeFrame,
};
