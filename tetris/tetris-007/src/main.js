import { renderFrame } from './render.js';
import { createInitialState } from './model.js';

import { createSession } from './session.js';
import { attachInput } from './input.js';

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  process.stdout.write(renderFrame(createInitialState()));
} else {
  // Minimal interactive wiring; resize, alternate-screen and failure handling
  // are the terminal lifecycle milestone, not input-decoder responsibilities.
  const wasRaw = Boolean(process.stdin.isRaw);
  const draw = state => process.stdout.write(`\x1b[H${renderFrame(state)}`);
  const session = createSession({ onChange: draw });
  attachInput(process.stdin, session, () => {
    process.stdin.setRawMode(wasRaw);
    process.stdin.pause();
  });
  process.stdin.setRawMode(true);
  process.stdin.resume();
  draw(session.state);
}
