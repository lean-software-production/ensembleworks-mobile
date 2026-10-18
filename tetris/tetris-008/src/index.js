import { renderFrame } from './render.js';
import { createInitialGame, createPieceSource, moveHorizontal, rotateClockwise, advanceDown } from './model.js';
import { createGravityController } from './gravity.js';
import { createKeyDecoder } from './input.js';

const MIN_COLUMNS = 50;
const MIN_ROWS = 24;

function boundedFrame(game, output) {
  const columns = Math.max(0, output.columns ?? MIN_COLUMNS);
  const rows = Math.max(0, output.rows ?? MIN_ROWS);
  return columns < MIN_COLUMNS || rows < MIN_ROWS
    ? (rows && columns ? 'Terminal too small (need 50x24)'.slice(0, columns) : '')
    : renderFrame(game);
}

// No escape sequences or live resources are used for redirected input/output.
export function start({ input = process.stdin, output = process.stdout, source, seed, scheduler = globalThis, signals = process } = {}) {
  const pieces = source ?? createPieceSource(seed);
  const game = createInitialGame({ source: pieces });
  if (!input.isTTY || !output.isTTY) {
    const frame = output.isTTY ? boundedFrame(game, output) : renderFrame(game);
    if (frame) output.write(frame);
    return game;
  }
  let closed = false;
  const originalRaw = !!input.isRaw;
  let rawAttempted = false;
  let cursorHidden = false;
  const gravity = createGravityController({ game, source: pieces, scheduler, onChange: draw });
  const close = () => {
    if (closed) return;
    closed = true;
    gravity.stop();
    input.removeListener('data', decode);
    input.removeListener('error', fail);
    output.removeListener?.('error', fail);
    output.removeListener?.('resize', drawCurrent);
    signals.removeListener('SIGINT', close);
    signals.removeListener('SIGTERM', close);
    try { if (rawAttempted) input.setRawMode(originalRaw); } catch { /* terminal already gone */ }
    try { input.pause?.(); } catch { /* input already gone */ }
    if (cursorHidden) {
      try { output.write('\x1b[?25h'); } catch { /* output already gone */ }
    }
  };
  function fail() { close(); }
  function draw(state) {
    if (closed) return;
    const frame = boundedFrame(state, output);
    // Clearing the old frame prevents stale text after shorter warnings or status changes.
    // No final newline: the bottom-right cell must never scroll the terminal.
    try {
      output.write(`\x1b[H\x1b[2J${frame}`);
    } catch (error) {
      close();
      throw error;
    }
  }
  function drawCurrent() { draw(gravity.game); }
  const decode = createKeyDecoder(key => {
    if (closed) return;
    if (key === 'quit' || key === 'q') return close();
    const current = gravity.game;
    if (key === 'p') return current.status === 'paused' ? gravity.resume() : gravity.pause();
    if (key === 'r') return gravity.restart();
    if (current.status !== 'running') return;
    if (key === 'down') gravity.setGame(advanceDown(current, pieces).game);
    else if (key === 'up') gravity.setGame(rotateClockwise(current));
    else if (key === 'left' || key === 'right') gravity.setGame(moveHorizontal(current, key === 'left' ? -1 : 1));
  });
  try {
    signals.on('SIGINT', close);
    signals.on('SIGTERM', close);
    input.on('error', fail);
    output.on?.('error', fail);
    output.on?.('resize', drawCurrent);
    cursorHidden = true;
    output.write('\x1b[?25l');
    if (!closed && input.setRawMode) {
      rawAttempted = true;
      input.setRawMode(true);
    }
    if (!closed) input.on('data', decode);
    if (!closed) input.resume?.();
    if (!closed) draw(game);
    if (!closed) gravity.start();
  } catch (error) {
    close();
    throw error;
  }
  return { get game() { return gravity.game; }, close };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  start();
}
