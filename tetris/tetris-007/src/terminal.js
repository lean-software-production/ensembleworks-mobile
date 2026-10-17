import { createSession } from './session.js';
import { createInitialState } from './model.js';
import { attachInput } from './input.js';
import { renderFrame } from './render.js';

const ENTER = '\x1b[?1049h\x1b[?25l';
const LEAVE = '\x1b[0m\x1b[?25h\x1b[?1049l';
const CLEAR = '\x1b[2J\x1b[H';

// Terminal ownership only: the session remains the sole gameplay/timer owner.
export function startTerminal({ input = process.stdin, output = process.stdout,
  signals = process, clock = globalThis, diagnostics = process.stderr,
  onExit = code => { process.exitCode = code; }, ...options } = {}) {
  let closed = false;
  let entered = false;
  let rawChanged = false;
  let session;
  let pending = 0;
  let exitCode = 0;
  let finalized = false;
  let finishing = false;
  const asyncOutput = Boolean(output._writableState);
  function finish() {
    if (!closed || pending || finalized || finishing) return;
    const complete = () => {
      finishing = false;
      if (pending || finalized) return;
      // A failed write can finish before an asynchronous _destroy callback.
      // Keep the error handler until the resulting error/close lifecycle ends.
      if (asyncOutput && output.destroyed && !output.closed) return;
      finalized = true;
      output.removeListener('close', finish);
      output.removeListener('error', fail);
      onExit(exitCode);
    };
    if (asyncOutput) { finishing = true; setImmediate(complete); }
    else complete();
  }
  function write(text) {
    if (!asyncOutput) return output.write(text);
    pending++;
    try {
      return output.write(text, error => {
        pending--;
        if (error) fail(error);
        finish();
      });
    } catch (error) { pending--; throw error; }
  }
  let detach = () => {};
  const wasRaw = Boolean(input.isRaw);
  const listeners = [];
  function listen(emitter, event, handler) {
    emitter.on(event, handler);
    listeners.push(() => emitter.removeListener(event, handler));
  }
  function cleanup(code = 0) {
    if (closed) return;
    closed = true;
    exitCode = Math.max(exitCode, code);
    session?.stop();
    detach();
    for (const remove of listeners) remove();
    // Each restoration is independent: a broken output must not strand raw mode.
    try { if (rawChanged) input.setRawMode(wasRaw); } catch {}
    try { input.pause(); } catch {}
    try { if (entered) write(LEAVE); } catch (error) { fail(error); }
    finish();
  }
  function fail(error) {
    if (finalized) return;
    if (exitCode !== 1) {
      exitCode = 1;
      try { diagnostics.write(`Tetris: ${error.message || 'terminal failure'}\n`); } catch {}
    }
    if (!closed) cleanup(1);
    else finish();
  }
  const guard = fn => (...args) => { if (!closed) { try { return fn(...args); } catch (error) { fail(error); } } };
  const sufficient = () => Number.isFinite(output.columns) && Number.isFinite(output.rows)
    && output.columns >= 40 && output.rows >= 24;
  function draw() {
    if (sufficient()) write(`\x1b[H\x1b[2K${renderFrame(session.state).replaceAll('\n', '\r\n\x1b[2K')}`);
    else {
      const width = Math.max(0, Math.floor(output.columns || 0));
      if (width && output.rows > 0) write(`\x1b[H${'Terminal needs 40x24'.slice(0, width)}`);
    }
  }
  output.on('error', fail);
  if (asyncOutput) output.on('close', finish);
  try {
    if (!input.isTTY || !output.isTTY) {
      write(renderFrame(createInitialState(options.typeSource)));
      cleanup();
      return { cleanup, get session() { return session; } };
    }
    listen(input, 'error', fail);
    entered = true;
    write(ENTER + CLEAR);
    rawChanged = true;
    input.setRawMode(true);
    const safeClock = {
      setTimeout: (fn, delay) => clock.setTimeout(guard(fn), delay),
      clearTimeout: id => clock.clearTimeout(id),
    };
    session = createSession({ ...options, clock: safeClock, onChange: guard(draw) });
    session.setSuspended(!sufficient());
    detach = attachInput(input, { stop: () => session.stop(), dispatch: guard(intent => session.dispatch(intent)) }, cleanup);
    listen(output, 'resize', guard(() => {
      session.setSuspended(!sufficient());
      write(CLEAR);
      draw();
    }));
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) listen(signals, signal, () => cleanup());
    input.resume();
    draw();
  } catch (error) { fail(error); }
  return { cleanup, get session() { return session; } };
}
