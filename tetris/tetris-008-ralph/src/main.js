import { renderFrame, FRAME_ROWS, FRAME_COLUMNS } from './render.js';
import { createGame } from './model.js';
import { createSession } from './session.js';
import { attachInput } from './input.js';

// Pipes receive one readable frame, without ANSI, listeners or a live timer.
export function start({ input = process.stdin, output = process.stdout, game = createGame(),
  clock = globalThis, signals = process, onError = () => { signals.exitCode = 1; } } = {}) {
  if (!input.isTTY || !output.isTTY) {
    output.write(renderFrame(game));
    return { game, quit() {} };
  }
  const wasRaw = Boolean(input.isRaw);
  let closed = false, session, detach = () => {};
  const removers = [];
  function listen(target, event, handler) {
    if (!target.on) return;
    target.on(event, handler);
    removers.push(() => target.removeListener(event, handler));
  }
  function quit() {
    if (closed) return;
    closed = true;
    // Each restoration is independent: a broken output must not leave raw mode on.
    const attempt = fn => { try { fn(); } catch {} };
    attempt(detach);
    attempt(() => session?.dispose());
    for (const remove of removers) attempt(remove);
    attempt(() => input.setRawMode(wasRaw));
    attempt(() => input.pause());
    attempt(() => output.write('\x1b[0m\x1b[?25h'));
  }
  function fail(error) { quit(); onError(error); }
  function guard(fn) {
    return (...args) => { if (!closed) { try { return fn(...args); } catch (error) { fail(error); } } };
  }
  const draw = guard(() => {
    const columns = Math.max(0, Math.floor(output.columns ?? 80));
    const rows = Math.max(0, Math.floor(output.rows ?? 24));
    const fits = columns >= FRAME_COLUMNS && rows >= FRAME_ROWS;
    const text = fits ? renderFrame(game, { color: true })
      : rows > 0 ? `Need ${FRAME_COLUMNS}x${FRAME_ROWS} terminal`.slice(0, Math.max(0, columns - 1)) : '';
    // Clear stale cells on shrink and shorter status lines; never append a newline.
    output.write('\x1b[H\x1b[2J' + text);
  });
  try {
    const safeClock = {
      setTimeout: (fn, delay) => clock.setTimeout(guard(fn), delay),
      clearTimeout: id => clock.clearTimeout(id),
    };
    session = createSession(game, { clock: safeClock, onChange: draw });
    detach = attachInput(input, { game, dispatch: guard(action => session.dispatch(action)) }, quit);
    for (const event of ['SIGINT', 'SIGTERM', 'SIGHUP']) listen(signals, event, quit);
    listen(input, 'end', quit);
    listen(input, 'close', quit);
    listen(input, 'error', fail);
    listen(output, 'error', fail);
    listen(output, 'resize', draw);
    input.setRawMode(true); input.resume();
    output.write('\x1b[?25l'); draw();
  } catch (error) { fail(error); }
  return { game, session, quit };
}

// Keep the production composition importable for controlled terminal tests.
import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) start();
