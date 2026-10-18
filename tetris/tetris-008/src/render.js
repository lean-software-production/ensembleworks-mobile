export const WIDTH = 10;
export const HEIGHT = 20;

// Pure, terminal-escape-free frame: 22 board lines and two status lines.
// Cells are doubled horizontally so the frame remains legible in a terminal.
export function renderFrame({ board = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(null)), active = null, score = 0 } = {}) {
  const border = `+${'-'.repeat(WIDTH * 2)}+`;
  const activeCells = new Set(active?.cells.map(([x, y]) => `${active.x + x},${active.y + y}`) ?? []);
  const rows = board.map((row, y) => `|${row.map((cell, x) => activeCells.has(`${x},${y}`) ? '<>' : cell ? '[]' : '  ').join('')}|`);
  return [border, ...rows, border, `Score: ${score}`, 'Arrows: move/rotate/drop  P: pause  Q: quit'].join('\n');
}
