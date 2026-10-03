'use strict';

const MAX_DISPLAY_ROWS = 24;
const RESET_COLOR = '\x1b[0m';
const PIECE_COLORS = Object.freeze({
  I: '\x1b[96m',
  J: '\x1b[94m',
  L: '\x1b[93m',
  O: '\x1b[33m',
  S: '\x1b[92m',
  T: '\x1b[95m',
  Z: '\x1b[91m'
});

class TerminalRenderer {
  constructor(output = process.stdout) {
    this.output = output;
    this.useColor = Boolean(output.isTTY && !('NO_COLOR' in process.env) && process.env.TERM !== 'dumb');
  }

  cell(cell) {
    if (!cell) return '  ';
    const color = this.useColor && PIECE_COLORS[cell];
    return color ? `${color}[]${RESET_COLOR}` : '[]';
  }

  frame({ rows, width, score, lines, level, gameOver }) {
    const border = `+${'-'.repeat(width * 2)}+`;
    const boardRows = rows.map((row) => `|${row.map((cell) => this.cell(cell)).join('')}|`);
    const status = `Score ${score}  Lines ${lines}  Level ${level}`;
    const message = gameOver
      ? 'GAME OVER - r restart, q quit'
      : 'Arrows/WASD move  W/Up rotate  Space drop  q quit';
    const frame = [border, ...boardRows, border, status, message].join('\n');

    if (frame.split('\n').length > MAX_DISPLAY_ROWS) {
      throw new Error(`Display exceeds ${MAX_DISPLAY_ROWS} rows`);
    }
    return frame;
  }

  render(snapshot) {
    this.output.write(`\x1b[2J\x1b[H${this.frame(snapshot)}`);
  }

  hideCursor() {
    if (this.output.isTTY) this.output.write('\x1b[?25l');
  }

  showCursor() {
    if (this.output.isTTY) this.output.write('\x1b[?25h\n');
  }
}

module.exports = { MAX_DISPLAY_ROWS, TerminalRenderer };
