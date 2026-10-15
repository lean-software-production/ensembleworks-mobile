'use strict';

const { advanceGame, restartGame } = require('./game');

// Pieces fall once per second. A caller may inject a setInterval/clearInterval
// pair to make scheduling deterministic in tests or another terminal host.
const GRAVITY_INTERVAL_MS = 1000;

function validateScheduler(scheduler) {
  if (!scheduler || typeof scheduler.setInterval !== 'function' || typeof scheduler.clearInterval !== 'function') {
    throw new TypeError('scheduler must provide setInterval and clearInterval');
  }
}

/**
 * Drive a game at a fixed interval. At most one interval is installed at any
 * time; pausing, game over, and stop all remove it. Each interval performs one
 * existing advanceGame action, so no catch-up actions occur on resume/restart.
 */
function createGravityController(game, {
  interval = GRAVITY_INTERVAL_MS,
  scheduler = globalThis,
} = {}) {
  if (!game || !game.pieceSource || typeof game.pieceSource.nextType !== 'function') {
    throw new TypeError('game must be a game state');
  }
  if (!Number.isFinite(interval) || interval <= 0) {
    throw new RangeError('interval must be a positive number');
  }
  validateScheduler(scheduler);

  let timer = null;

  function clearTimer() {
    if (timer !== null) {
      scheduler.clearInterval(timer);
      timer = null;
    }
  }

  function tick() {
    if (game.paused || game.gameOver) {
      if (game.gameOver) clearTimer();
      return null;
    }
    const result = advanceGame(game);
    if (game.gameOver) clearTimer();
    return result;
  }

  function start() {
    if (game.gameOver) return false;
    game.paused = false;
    if (timer === null) timer = scheduler.setInterval(tick, interval);
    return true;
  }

  function pause() {
    if (game.gameOver) return false;
    game.paused = true;
    clearTimer();
    return true;
  }

  function resume() {
    return start();
  }

  function stop() {
    clearTimer();
  }

  function restart() {
    restartGame(game);
    game.paused = false;
    clearTimer();
    start();
    return game;
  }

  return {
    start, pause, resume, stop, restart, tick,
    get running() { return timer !== null; },
  };
}

module.exports = { GRAVITY_INTERVAL_MS, createGravityController };
