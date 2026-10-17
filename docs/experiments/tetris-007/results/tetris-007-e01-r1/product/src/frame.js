export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;
// Leave the final column unused, even on a minimum-width terminal.
export const MIN_WIDTH = 64;
export const FRAME_HEIGHT = 24;
export const TYPE_COLOURS = Object.freeze({
  I: 96, O: 93, T: 95, S: 92, Z: 91, J: 94, L: 33,
});

function scoreText(score) {
  if (!Number.isFinite(score) || score < 0) return '0';
  const value = Math.floor(score);
  return value <= 999999999 ? String(value) : value.toExponential(2);
}

/** Complete frame without cursor commands or trailing newline; never mutates data. */
export function formatFrame({
  grid = Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null)),
  score = 0,
  status = 'running',
  colour = false,
} = {}) {
  const paint = (text, code) => colour ? `\x1b[${code}m${text}\x1b[0m` : text;
  const border = paint(`+${'-'.repeat(BOARD_WIDTH * 2)}+`, '1;94');
  const rows = [border];
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    let row = paint('|', '1;94');
    for (let x = 0; x < BOARD_WIDTH; x++) {
      const type = grid[y]?.[x];
      row += TYPE_COLOURS[type] ? paint(`${type}${type}`, TYPE_COLOURS[type]) : '  ';
    }
    rows.push(row + paint('|', '1;94'));
  }
  rows.push(border);
  const label = status === 'game-over' ? 'GAME OVER' : status === 'paused' ? 'PAUSED' : 'TETRIS';
  rows.push(paint(`${label}  Score: ${scoreText(score)}`, '1;93'));
  rows.push(paint(status === 'game-over'
    ? 'R restart | Q quit'
    : 'Arrows move/rotate/down | P pause | Q quit', '96'));
  return rows.join('\n');
}
