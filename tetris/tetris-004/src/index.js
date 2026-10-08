'use strict';

const { TetrisGame } = require('./game');

const EMPTY_CELL = ' ';

const INPUT_ACTIONS = Object.freeze({
  '\u0003': 'quit',
  q: 'quit', Q: 'quit',
  a: 'left', A: 'left', '\uE000': 'left',
  d: 'right', D: 'right', '\uE001': 'right',
  s: 'softDrop', S: 'softDrop', '\uE002': 'softDrop',
  w: 'rotateRight', W: 'rotateRight', x: 'rotateRight', X: 'rotateRight', '\uE003': 'rotateRight',
  z: 'rotateLeft', Z: 'rotateLeft',
  ' ': 'hardDrop',
  r: 'restart', R: 'restart',
});

function normalizeInput(keys) {
  return keys
    .replace(/\u001b\[D/g, '\uE000')
    .replace(/\u001b\[C/g, '\uE001')
    .replace(/\u001b\[B/g, '\uE002')
    .replace(/\u001b\[A/g, '\uE003');
}

function inputAction(key) {
  return INPUT_ACTIONS[key];
}

/**
 * Build the entire visible game in exactly 24 rows: a 20-row board inside
 * borders, followed by a status row and a controls row.  Keeping this a pure
 * function makes each repaint replace the previous frame rather than append
 * a scrolling transcript.
 */
function renderGame(game) {
  const visibleCells = new Map(
    game.visibleCells().map(({ x, y, type }) => [`${x},${y}`, type]),
  );
  const center = (text) => text.slice(0, game.width).padStart(
    Math.floor((game.width + text.length) / 2),
  ).padEnd(game.width);
  const rows = [`┌${'─'.repeat(game.width)}┐`];
  const messageRows = game.gameOver
    ? new Map([[Math.floor(game.height / 2) - 1, center('GAME OVER!')], [Math.floor(game.height / 2), center('R: restart')]])
    : new Map();

  for (let y = 0; y < game.height; y += 1) {
    const message = messageRows.get(y);
    const cells = message || Array.from({ length: game.width }, (_, x) => (
      visibleCells.get(`${x},${y}`) || EMPTY_CELL
    )).join('');
    rows.push(`│${cells}│`);
  }

  rows.push(`└${'─'.repeat(game.width)}┘`);
  rows.push(`Score: ${game.score}  Lines: ${game.lines}  Level: ${game.level}`);
  rows.push('←/→ move  ↓ soft drop  W rotate  Space drop  Q quit');
  return rows.join('\n');
}

function repaint(output, game) {
  // Home after clearing so every frame occupies the same 24 terminal rows.
  output.write(`\u001b[?25l\u001b[2J\u001b[H${renderGame(game)}`);
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

  performInputAction(action) {
    switch (action) {
      case 'left':
        return this.game.move(-1);
      case 'right':
        return this.game.move(1);
      case 'softDrop':
        this.game.tick();
        return true;
      case 'rotateRight':
        return this.game.rotate();
      case 'rotateLeft':
        return this.game.rotate(-1);
      case 'hardDrop':
        this.game.hardDrop();
        return true;
      case 'restart':
        if (!this.game.gameOver) return false;
        this.game.reset();
        this.startGravity();
        return true;
      default:
        return false;
    }
  }

  handleInput(keys) {
    let changed = false;
    // Convert multi-byte arrow escape sequences before handling individual
    // characters so the final A/B/C/D is not mistaken for a letter control.
    for (const key of normalizeInput(keys)) {
      const action = inputAction(key);
      if (action === 'quit') {
        this.quit();
        return;
      }
      changed = this.performInputAction(action) || changed;
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
    process.stdout.write('\u001b[0m\u001b[?25h\u001b[2J\u001b[H');
    process.exit(0);
  };

  controller = new TerminalController({
    game,
    onUpdate: (updatedGame) => repaint(process.stdout, updatedGame),
    onQuit: exitGame,
  });
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

module.exports = {
  TetrisGame,
  TerminalController,
  renderGame,
  repaint,
  startGame,
  normalizeInput,
  inputAction,
};
