'use strict';

const { TetrisGame } = require('./TetrisGame');

const QUIT = Symbol('quit');
const RESTART = Symbol('restart');
const INPUT_ACTIONS = {
  '\u0003': QUIT,
  q: QUIT,
  Q: QUIT,
  a: ['move', [-1], false],
  A: ['move', [-1], false],
  '\uE000': ['move', [-1], false],
  d: ['move', [1], false],
  D: ['move', [1], false],
  '\uE001': ['move', [1], false],
  s: ['tick', [], true],
  S: ['tick', [], true],
  '\uE002': ['tick', [], true],
  w: ['rotate', [], false],
  W: ['rotate', [], false],
  x: ['rotate', [], false],
  X: ['rotate', [], false],
  '\uE003': ['rotate', [], false],
  z: ['rotate', [-1], false],
  Z: ['rotate', [-1], false],
  ' ': ['hardDrop', [], true],
  r: RESTART,
  R: RESTART,
};

function normalizeInput(keys) {
  return keys
    .replace(/\u001b\[D/g, '\uE000')
    .replace(/\u001b\[C/g, '\uE001')
    .replace(/\u001b\[B/g, '\uE002')
    .replace(/\u001b\[A/g, '\uE003');
}

/**
 * Owns the terminal-specific parts of a running game.  Keeping this separate
 * from TetrisGame makes gameplay usable without a TTY (and easy to test).
 */
class TerminalController {
  constructor({
    game = new TetrisGame(),
    input = process.stdin,
    output = process.stdout,
    tickMs = 700,
    onUpdate = () => {},
    onQuit = () => {},
  } = {}) {
    this.game = game;
    this.input = input;
    this.output = output;
    this.tickMs = tickMs;
    this.onUpdate = onUpdate;
    this.onQuit = onQuit;
    this.running = false;
    this.timer = null;
    this.changedRawMode = false;
    this.handleInput = this.handleInput.bind(this);
  }

  start() {
    if (this.running) return;
    if (!this.input.isTTY) {
      throw new Error('Terminal Tetris must be started from an interactive terminal.');
    }

    this.running = true;
    if (typeof this.input.setRawMode === 'function') {
      this.input.setRawMode(true);
      this.changedRawMode = true;
    }
    this.input.setEncoding('utf8');
    this.input.resume();
    this.input.on('data', this.handleInput);
    this.startGravity();
    this.onUpdate(this.game);
  }

  startGravity() {
    if (!this.running || this.timer) return;
    this.timer = setInterval(() => {
      this.game.tick();
      this.onUpdate(this.game);
      if (this.game.gameOver) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }, this.tickMs);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    clearInterval(this.timer);
    this.timer = null;
    this.input.removeListener('data', this.handleInput);
    if (this.changedRawMode && typeof this.input.setRawMode === 'function') {
      this.input.setRawMode(false);
      this.changedRawMode = false;
    }
    this.input.pause();
  }

  quit() {
    this.stop();
    this.onQuit();
  }

  handleInput(keys) {
    let changed = false;
    for (const key of normalizeInput(keys)) {
      const result = this.dispatchInput(key);
      if (result === QUIT) return;
      changed = result || changed;
    }
    if (changed) this.onUpdate(this.game);
  }

  dispatchInput(key) {
    const action = INPUT_ACTIONS[key];
    if (!action) return false;
    if (action === QUIT) {
      this.quit();
      return QUIT;
    }
    if (action === RESTART) return this.restart();

    const [method, args, alwaysChanges] = action;
    const changed = this.game[method](...args);
    return alwaysChanges || changed;
  }

  restart() {
    if (!this.game.gameOver) return false;
    this.game.reset();
    this.startGravity();
    return true;
  }
}

module.exports = { TerminalController };
