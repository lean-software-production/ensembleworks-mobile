export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;
export const FRAME_ROWS = 24;

// No terminal I/O or state mutation. No final newline: a 24-row terminal
// must not scroll into a 25th row after the controls.
export function renderFrame() {
  const border = `+${'-'.repeat(BOARD_WIDTH * 2)}+`;
  const row = `|${'  '.repeat(BOARD_WIDTH)}|`;
  return [
    border,
    ...Array(BOARD_HEIGHT).fill(row),
    border,
    'Score: 0',
    'Controls: none (board preview)',
  ].join('\n');
}
