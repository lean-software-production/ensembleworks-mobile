import { WIDTH, HEIGHT, cellsOf } from './model.js';
export const PALETTE = Object.freeze({ I: 96, O: 93, T: 95, S: 92, Z: 91, J: 94, L: 33 });
export function render(state, { color = false } = {}) {
  const paint = (text, code) => color ? `\x1b[${code}m${text}\x1b[0m` : text;
  const grid = state.board.map(row => [...row]);
  if (state.active) for (const [x,y] of cellsOf(state.active)) grid[y][x] = state.active.type;
  const border = paint('+' + '-'.repeat(WIDTH * 2) + '+', 36);
  const rows = [border];
  for (let y = 0; y < HEIGHT; y++) {
    rows.push(paint('|', 36) + grid[y].map(type => type ? paint('[]', PALETTE[type]) : '  ').join('') + paint('|', 36));
  }
  rows.push(border, paint(`Score: ${state.score} | ${state.status}`, 93), paint('Model: left/right, rotate, down; no keys', 36));
  // No trailing newline: exactly 24 visible rows, even on a 24-row terminal.
  return rows.join('\n');
}
