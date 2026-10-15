'use strict';

const { TetrisGame } = require('./tetris');

const CELL = '[]';
const EMPTY_CELL = '  ';

function boardRows(game) {
  const cells = game.board.map((row) => [...row]);
  if (game.current) {
    for (const [x, y] of game.cellsFor()) {
      if (y >= 0 && y < game.height && x >= 0 && x < game.width) cells[y][x] = game.current.type;
    }
  }
  return cells.map((row) => `|${row.map((cell) => (cell ? CELL : EMPTY_CELL)).join('')}|`);
}

function renderGame(game) {
  const status = game.gameOver
    ? `TETRIS  Score: ${game.score}  Lines: ${game.lines}  GAME OVER`
    : `TETRIS  Score: ${game.score}  Lines: ${game.lines}  Level: ${game.level}  Next: ${game.nextType}`;
  const border = `+${'-'.repeat(game.width * CELL.length)}+`;
  return [
    status,
    border,
    ...boardRows(game),
    border,
    'Arrows: move/rotate/down  Space: drop  Q: quit'
  ].join('\n');
}

class TerminalTetris {
  constructor({ game = new TetrisGame(), input = process.stdin, output = process.stdout, clock = globalThis } = {}) {
    this.game = game;
    this.input = input;
    this.output = output;
    this.clock = clock;
    this.timer = null;
    this.running = false;
    this.onData = this.handleInput.bind(this);
    this.onInterrupt = () => this.stop();
    this.inputBuffer = '';
  }

  render() {
    const display = renderGame(this.game)
      .split('\n')
      .map((line) => `\x1b[2K${line}`)
      .join('\n');
    this.output.write(`\x1b[H${display}`);
  }

  gravityDelay() {
    return Math.max(120, 800 - (this.game.level - 1) * 60);
  }

  scheduleGravity() {
    this.clock.clearTimeout(this.timer);
    if (!this.running || this.game.gameOver) return;
    this.timer = this.clock.setTimeout(() => {
      this.game.tick();
      this.render();
      this.scheduleGravity();
    }, this.gravityDelay());
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.output.write('\x1b[?1049h\x1b[2J\x1b[H\x1b[?25l');
    this.input.setRawMode(true);
    this.input.resume();
    this.input.on('data', this.onData);
    process.once('SIGINT', this.onInterrupt);
    this.render();
    this.scheduleGravity();
  }

  handleInput(data) {
    this.inputBuffer += data.toString();
    let changed = false;

    while (this.inputBuffer) {
      let key;
      if (this.inputBuffer[0] === '\x1b') {
        if (this.inputBuffer.length === 1) break;
        if (this.inputBuffer[1] !== '[') {
          // A standalone Escape is ignored; process the following key immediately.
          this.inputBuffer = this.inputBuffer.slice(1);
          continue;
        }
        if (this.inputBuffer.length < 3) break;
        if ('ABCD'.includes(this.inputBuffer[2])) {
          key = this.inputBuffer.slice(0, 3);
          this.inputBuffer = this.inputBuffer.slice(3);
        } else {
          // Ignore unknown escape sequences without blocking later input.
          this.inputBuffer = this.inputBuffer.slice(1);
          continue;
        }
      } else {
        key = this.inputBuffer[0];
        this.inputBuffer = this.inputBuffer.slice(1);
      }

      if (key === '\u0003' || key === 'q' || key === 'Q') return this.stop();
      if (this.game.gameOver) continue;

      if (key === '\x1b[D' || key === 'a' || key === 'A') this.game.moveLeft();
      else if (key === '\x1b[C' || key === 'd' || key === 'D') this.game.moveRight();
      else if (key === '\x1b[B' || key === 's' || key === 'S') this.game.softDrop();
      else if (key === '\x1b[A' || key === 'w' || key === 'W') this.game.rotate();
      else if (key === ' ') this.game.hardDrop();
      else continue;
      changed = true;
    }

    if (changed) this.render();
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.clock.clearTimeout(this.timer);
    this.input.removeListener('data', this.onData);
    process.removeListener('SIGINT', this.onInterrupt);
    this.input.setRawMode(false);
    this.input.pause();
    this.output.write('\x1b[?25h\x1b[?1049l');
  }
}

module.exports = { TerminalTetris, renderGame };
