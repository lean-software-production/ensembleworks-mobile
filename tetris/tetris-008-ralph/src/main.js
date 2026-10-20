import { renderFrame } from './render.js';
import { createGame } from './model.js';
import { createSession } from './session.js';
import { attachInput } from './input.js';

// One bounded plain preview for pipes; only interactive input owns a session.
export function start({ input = process.stdin, output = process.stdout, game = createGame(), clock = globalThis } = {}) {
  if (!input.isTTY || !output.isTTY) {
    output.write(renderFrame(game));
    return { game, quit() {} };
  }
  const draw = () => output.write('\x1b[H' + renderFrame(game, { color: true }));
  const wasRaw = Boolean(input.isRaw);
  let closed = false;
  const session = createSession(game, { clock, onChange: draw });
  const detach = attachInput(input, session, quit);
  function quit() {
    if (closed) return;
    closed = true;
    detach(); session.dispose();
    input.setRawMode(wasRaw); input.pause();
    output.write('\x1b[0m\x1b[?25h');
  }
  input.setRawMode(true); input.resume();
  output.write('\x1b[2J\x1b[?25l'); draw();
  return { game, session, quit };
}

// Keep the production composition importable for controlled terminal tests.
import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) start();
