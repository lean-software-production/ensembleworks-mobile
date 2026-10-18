import { renderFrame } from './render.js';
import { createInitialGame, createPieceSource } from './model.js';

// Task 1 prints one bounded static frame, including for non-TTY capture.
// Later session work will replace this adapter without changing the renderer.
export function start({ output = process.stdout, source, seed } = {}) {
  // 24 visible lines need only 23 line feeds: a final newline scrolls a 24-row PTY.
  const game = createInitialGame({ source: source ?? createPieceSource(seed) });
  output.write(renderFrame(game));
  return game;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  start();
}
