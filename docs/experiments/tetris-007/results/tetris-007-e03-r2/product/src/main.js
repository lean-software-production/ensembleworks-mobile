import { emptyBoard, renderFrame } from './render.js';

// Initial display milestone: one snapshot, no input listeners or timers.
process.stdout.write(renderFrame(
  { board: emptyBoard(), score: 0, phase: 'running' },
  { colour: Boolean(process.stdin.isTTY && process.stdout.isTTY) },
));
