'use strict';

const readline = require('node:readline');
const { TetrisGame } = require('./game');

const ESC = '\x1b';
const FILLED_CELL = '██';
const EMPTY_CELL = '  ';

function boardCells(game) {
  const cells = game.board.map((row) => row.slice());
  if (!game.gameOver && game.current) {
    for (const [x, y] of game.cellsFor()) {
      if (y >= 0 && y < game.height && x >= 0 && x < game.width) cells[y][x] = game.current.type;
    }
  }
  return cells;
}

function renderGame(game) {
  const cells = boardCells(game);
  const status = game.gameOver
    ? `TETRIS — GAME OVER | Score: ${game.score} | Press Q to quit`
    : `TETRIS | Score: ${game.score} | Lines: ${game.lines} | Level: ${game.level}`;
  const border = `+${'-'.repeat(game.width * 2)}+`;
  const rows = [status, border];

  for (const row of cells) {
    rows.push(`|${row.map((cell) => (cell ? FILLED_CELL : EMPTY_CELL)).join('')}|`);
  }

  rows.push(border);
  rows.push('←/H: left  →/L: right  ↑/X: rotate  ↓/J: drop  Space: hard drop  Q: quit');
  return rows.join('\n');
}

class TerminalTetris {
  constructor({ game = new TetrisGame(), input = process.stdin, output = process.stdout } = {}) {
    this.game = game;
    this.input = input;
    this.output = output;
    this.timer = null;
    this.stopped = false;
    this.onKeypress = this.onKeypress.bind(this);
    this.onSignal = this.onSignal.bind(this);
  }

  start() {
    if (!this.input.isTTY || !this.output.isTTY) {
      this.output.write('Tetris needs an interactive terminal.\n');
      return false;
    }

    readline.emitKeypressEvents(this.input);
    this.input.setRawMode(true);
    this.input.resume();
    this.input.on('keypress', this.onKeypress);
    process.on('SIGTERM', this.onSignal);
    process.on('SIGHUP', this.onSignal);
    this.output.write(`${ESC}[?25l`);
    this.render();
    this.timer = setInterval(() => {
      this.game.tick();
      this.render();
    }, 1000);
    return true;
  }

  render() {
    if (!this.stopped) this.output.write(`${ESC}[2J${ESC}[H${renderGame(this.game)}`);
  }

  onKeypress(key, details = {}) {
    if (key === 'q' || key === 'Q' || (details.ctrl && details.name === 'c')) {
      this.stop();
      return;
    }
    if (this.game.gameOver) return;

    switch (details.name || key) {
      case 'left': case 'h': case 'H': this.game.move(-1, 0); break;
      case 'right': case 'l': case 'L': this.game.move(1, 0); break;
      case 'up': case 'x': case 'X': case 'k': case 'K': this.game.rotate(); break;
      case 'down': case 'j': case 'J': this.game.softDrop(); break;
      case 'space': case ' ': this.game.hardDrop(); break;
      default: return;
    }
    this.render();
  }

  onSignal() {
    this.stop();
    process.exit(0);
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.input.removeListener('keypress', this.onKeypress);
    process.removeListener('SIGTERM', this.onSignal);
    process.removeListener('SIGHUP', this.onSignal);
    if (this.input.isRaw) this.input.setRawMode(false);
    this.input.pause();
    this.output.write(`${ESC}[0m${ESC}[?25h\n`);
  }
}

if (require.main === module) new TerminalTetris().start();

module.exports = { TerminalTetris, boardCells, renderGame };
