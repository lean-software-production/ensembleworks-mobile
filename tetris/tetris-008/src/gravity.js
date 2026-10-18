import { advanceDown, restartGame } from './model.js';

export const GRAVITY_MS = 1000;

// The owner of this controller supplies a scheduler and stops it on session exit.
// Every resumed/restarted interval starts afresh; no elapsed time is banked.
export function createGravityController({ game, source, scheduler = globalThis, onChange = () => {} }) {
  let current = game;
  let timer = null;
  const stopTimer = () => {
    if (timer !== null) scheduler.clearInterval(timer);
    timer = null;
  };
  const tick = () => {
    if (current.status !== 'running') return;
    current = advanceDown(current, source).game;
    onChange(current);
    if (current.status !== 'running') stopTimer();
  };
  const startTimer = () => {
    if (timer === null && current.status === 'running') timer = scheduler.setInterval(tick, GRAVITY_MS);
  };
  return {
    get game() { return current; },
    start() { startTimer(); },
    pause() {
      if (current.status !== 'running') return;
      stopTimer();
      current = { ...current, status: 'paused' };
      onChange(current);
    },
    resume() {
      if (current.status !== 'paused') return;
      current = { ...current, status: 'running' };
      onChange(current);
      startTimer();
    },
    restart() {
      if (current.status !== 'over') return;
      current = restartGame(current, source);
      onChange(current);
      startTimer();
    },
    stop: stopTimer,
  };
}
