'use strict';

const { TetrisGame } = require('./game');

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
    // Convert multi-byte arrow escape sequences before handling individual
    // characters so the final A/B/C/D is not mistaken for a letter control.
    const controls = keys
      .replace(/\u001b\[D/g, '\uE000')
      .replace(/\u001b\[C/g, '\uE001')
      .replace(/\u001b\[B/g, '\uE002')
      .replace(/\u001b\[A/g, '\uE003');
    for (const key of controls) {
      switch (key) {
        case '\u0003': // Ctrl-C
        case 'q':
        case 'Q':
          this.quit();
          return;
        case 'a':
        case 'A':
        case '\uE000':
          changed = this.game.move(-1) || changed;
          break;
        case 'd':
        case 'D':
        case '\uE001':
          changed = this.game.move(1) || changed;
          break;
        case 's':
        case 'S':
        case '\uE002':
          this.game.tick();
          changed = true;
          break;
        case 'w':
        case 'W':
        case 'x':
        case 'X':
        case '\uE003':
          changed = this.game.rotate() || changed;
          break;
        case 'z':
        case 'Z':
          changed = this.game.rotate(-1) || changed;
          break;
        case ' ':
          this.game.hardDrop();
          changed = true;
          break;
        case 'r':
        case 'R':
          if (this.game.gameOver) {
            this.game.reset();
            this.startGravity();
            changed = true;
          }
          break;
        default:
          break;
      }
    }
    if (changed) this.onUpdate(this.game);
  }
}

function startGame() {
  const game = new TetrisGame();
  let controller;
  const exitGame = () => {
    controller.stop();
    process.removeListener('SIGINT', exitGame);
    process.removeListener('SIGTERM', exitGame);
    process.exit(0);
  };

  controller = new TerminalController({ game, onQuit: exitGame });
  process.stdout.write(`Terminal Tetris (${game.width}x${game.height})\nControls: arrows or A/D/S move, W/Up rotate, Space drop, Q quit.\n`);
  controller.start();
  process.on('SIGINT', exitGame);
  process.on('SIGTERM', exitGame);
  return controller;
}

if (require.main === module) {
  try {
    startGame();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { TetrisGame, TerminalController, startGame };
