import {
  createInitialState, createRandomTypeSource, descend, moveLeft, moveRight,
  rotateClockwise, restart, togglePause,
} from './model.js';

export const GRAVITY_INTERVAL = 1000;

// The sole action/timer owner. Input and terminal adapters are separate concerns.
export function createSession({
  typeSource = createRandomTypeSource(),
  state = createInitialState(typeSource),
  clock = globalThis,
  onChange = () => {},
} = {}) {
  let timer = null;
  let generation = 0;
  let stopped = false;
  let suspended = false;
  const running = () => !stopped && !suspended && state.status === 'running';
  function cancel() {
    generation++;
    if (timer !== null) clock.clearTimeout(timer);
    timer = null;
  }
  function schedule() {
    cancel();
    if (!running()) return;
    const token = generation;
    timer = clock.setTimeout(() => {
      if (token !== generation || !running()) return;
      timer = null;
      const result = descend(state, typeSource);
      schedule();
      onChange(state, result);
    }, GRAVITY_INTERVAL);
  }
  function dispatch(intent) {
    if (stopped || suspended) return { ignored: true };
    let result;
    switch (intent) {
      case 'left': result = moveLeft(state); break;
      case 'right': result = moveRight(state); break;
      case 'rotate': result = rotateClockwise(state); break;
      case 'down': result = descend(state, typeSource); break;
      case 'pause': result = togglePause(state); break;
      case 'restart': result = restart(state, typeSource); break;
      default: return { ignored: true };
    }
    if (result.locked || result.restarted || result.pauseChanged) schedule();
    onChange(state, result);
    return result;
  }
  schedule();
  return {
    state, dispatch,
    setSuspended(value) {
      if (stopped || suspended === Boolean(value)) return;
      suspended = Boolean(value);
      schedule();
    },
    stop() { stopped = true; cancel(); },
  };
}
