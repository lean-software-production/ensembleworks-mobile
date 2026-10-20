import { createState, advance, moveHorizontal, rotate, restart } from './model.js';
import { render } from './render.js';
export const INTERVAL = 500;

export function decoder(emit) {
  let mode = 'plain', arrow = true;
  return chunk => {
    for (const key of chunk.toString()) {
      // Interrupt is out-of-band, even inside an unfinished escape sequence.
      if (key === '\x03') { mode = 'plain'; emit('quit'); continue; }
      if (key === '\x1b') { mode = 'escape'; arrow = true; continue; }
      if (mode === 'escape') {
        if (key === '[') mode = 'csi';
        else if (key === 'O') mode = 'ss3';
        else if (key >= ' ' && key <= '/') mode = 'escape-final';
        else mode = 'plain';
        continue;
      }
      if (mode === 'escape-final') {
        if (key >= '0' && key <= '~') mode = 'plain';
        continue;
      }
      if (mode === 'ss3') {
        // Unsupported SS3 keypad/function keys are one sequence, not bindings.
        // Retain parameters/intermediates across chunks until the final byte.
        if (key >= '@' && key <= '~') mode = 'plain';
        continue;
      }
      if (mode === 'csi') {
        // ECMA-48: parameters 0x30–0x3f, intermediates 0x20–0x2f,
        // final 0x40–0x7e. Never interpret unknown sequence contents as keys.
        if (key >= '@' && key <= '~') {
          const action = arrow && { A: 'rotate', B: 'down', C: 'right', D: 'left' }[key];
          mode = 'plain';
          if (action) emit(action);
        } else arrow = false;
        continue;
      }
      const action = { p: 'pause', r: 'restart', q: 'quit' }[key];
      if (action) emit(action);
    }
  };
}

// All resources belong to this owner; injected clocks and streams use this same path.
export function startSession({ input = process.stdin, output = process.stdout, signals = process,
  clock = globalThis, next, onClose = () => {} } = {}) {
  const state = createState(next);
  let timer = null, closed = false, raw = false;
  const interactive = Boolean(input.isTTY && output.isTTY);
  const oldRaw = Boolean(input.isRaw);
  function stopTimer() { if (timer !== null) clock.clearTimeout(timer); timer = null; }
  function schedule() {
    stopTimer();
    if (!closed && state.status === 'running') timer = clock.setTimeout(() => {
      timer = null;
      guarded(() => { advance(state); draw(); schedule(); });
    }, INTERVAL);
  }
  function draw() {
    if (!interactive) { output.write(render(state)); return; }
    const columns = output.columns ?? 80, rows = output.rows ?? 24;
    const frame = columns >= 40 && rows >= 24 ? render(state, { color: true, live: true })
      : rows > 0 && columns > 0 ? 'Need 40x24 terminal'.slice(0, Math.max(0, columns - 1)) : '';
    output.write('\x1b[H\x1b[2J' + frame);
  }
  function cleanup() {
    if (closed) return;
    closed = true; stopTimer();
    input.removeListener('data', data); output.removeListener('resize', resize);
    for (const event of ['SIGINT', 'SIGTERM', 'SIGHUP']) signals.removeListener(event, cleanup);
    input.removeListener('error', failure); output.removeListener('error', failure);
    try { if (raw) input.setRawMode(oldRaw); } catch {}
    try { if (interactive) output.write('\x1b[0m\x1b[?25h'); } catch {}
    if (interactive) input.pause();
    onClose();
  }
  function failure() { cleanup(); }
  function guarded(fn) { try { fn(); } catch (error) { cleanup(); throw error; } }
  function action(key) {
    if (closed) return;
    guarded(() => {
      if (key === 'quit') return cleanup();
      if (key === 'pause' && state.status !== 'game-over') {
        state.status = state.status === 'paused' ? 'running' : 'paused'; schedule();
      } else if (key === 'restart' && state.status === 'game-over') { restart(state); schedule(); }
      else if (state.status === 'running') {
        if (key === 'left') moveHorizontal(state, -1);
        if (key === 'right') moveHorizontal(state, 1);
        if (key === 'rotate') rotate(state);
        if (key === 'down') { advance(state); if (state.status === 'game-over') stopTimer(); }
      }
      draw();
    });
  }
  const data = decoder(action), resize = () => guarded(draw);
  if (!interactive) { draw(); closed = true; onClose(); }
  else guarded(() => {
    input.on('error', failure); output.on('error', failure);
    for (const event of ['SIGINT', 'SIGTERM', 'SIGHUP']) signals.on(event, cleanup);
    input.on('data', data); output.on('resize', resize);
    raw = true; input.setRawMode(true); input.resume();
    output.write('\x1b[?25l'); draw(); schedule();
  });
  return { state, action, cleanup };
}
