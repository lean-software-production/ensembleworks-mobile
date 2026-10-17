import { pathToFileURL } from 'node:url';
import { renderFrame } from './render.js';

// Task 1 is a one-frame display, with no input listeners, timers or mode changes.
export function main({ input = process.stdin, output = process.stdout } = {}) {
  const snapshot = {
    board: Array.from({ length: 20 }, () => Array(10).fill(null)),
    score: 0,
    phase: 'running'
  };
  const interactive = Boolean(input.isTTY && output.isTTY);
  const frame = renderFrame(snapshot, { color: interactive });
  if (interactive && (output.columns < 65 || output.rows < 24)) {
    const width = Math.max(0, (output.columns ?? 0) - 1);
    if (output.rows > 0 && width > 0) output.write('Need terminal 65x24'.slice(0, width));
    return;
  }
  output.write(frame);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
