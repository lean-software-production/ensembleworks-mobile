import { renderFrame } from './render.js';
import { createInitialGame, createPieceSource, moveHorizontal, rotateClockwise, advanceDown } from './model.js';
import { createGravityController } from './gravity.js';
import { createKeyDecoder } from './input.js';

// Non-TTY capture remains a single static frame. Interactive resources belong
// to the session; the injected ports allow input and time to be tested directly.
export function start({ input = process.stdin, output = process.stdout, source, seed, scheduler = globalThis } = {}) {
  const pieces = source ?? createPieceSource(seed);
  const game = createInitialGame({ source: pieces });
  if (!input.isTTY || !output.isTTY) {
    output.write(renderFrame(game));
    return game;
  }
  let closed = false;
  const draw = state => output.write(`\x1b[H${renderFrame(state)}`);
  const gravity = createGravityController({ game, source: pieces, scheduler, onChange: draw });
  const close = () => {
    if (closed) return;
    closed = true;
    gravity.stop();
    input.removeListener('data', decode);
    if (input.isRaw) input.setRawMode(false);
    input.pause?.();
    output.write('\x1b[?25h');
  };
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
  // The first frame has no trailing newline, avoiding scroll on a 24-row PTY.
  output.write(`\x1b[?25l${renderFrame(game)}`);
  input.setRawMode?.(true);
  input.on('data', decode);
  input.resume?.();
  gravity.start();
  return { get game() { return gravity.game; }, close };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  start();
}
