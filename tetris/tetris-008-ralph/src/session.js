import { descend, moveLeft, moveRight, rotateClockwise, restartGame } from './model.js';

export const GRAVITY_MS = 1000;

// Sole gravity owner; terminal adapters dispatch here and dispose on teardown.
// Chained timeouts deliberately do not replay elapsed time after a delayed tick.
export function createSession(game, { clock = globalThis, onChange = () => {} } = {}) {
  let timer = null;
  let generation = 0;
  let disposed = false;
  function cancel() {
    generation++;
    if (timer !== null) clock.clearTimeout(timer);
    timer = null;
  }
  function schedule() {
    if (disposed || game.status !== 'running' || timer !== null) return;
    const token = generation;
    timer = clock.setTimeout(() => {
      if (disposed || token !== generation) return;
      timer = null;
      if (game.status === 'running') {
        descend(game);
        onChange(game);
      }
      schedule();
    }, GRAVITY_MS);
  }
  function dispatch(action) {
    if (disposed) return false;
    let result = false;
    if (action === 'pause' && game.status === 'running') {
      game.status = 'paused';
      cancel();
      result = true;
    } else if (action === 'resume' && game.status === 'paused') {
      game.status = 'running';
      result = true;
    } else if (action === 'restart') {
      result = restartGame(game);
      if (result) cancel();
    } else {
      const actions = { left: moveLeft, right: moveRight, rotate: rotateClockwise, down: descend };
      if (actions[action]) result = actions[action](game);
    }
    if (game.status !== 'running') cancel();
    schedule();
    onChange(game);
    return result;
  }
  schedule();
  return { game, dispatch, dispose() { disposed = true; cancel(); } };
}
