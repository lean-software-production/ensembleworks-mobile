import { BOARD_WIDTH, activeCells } from './model.js';
export { BOARD_WIDTH, BOARD_HEIGHT, createEmptyState } from './model.js';

const pieceColours = { I: '96', O: '93', T: '95', S: '92', Z: '91', J: '94', L: '33' };

const colour = (code, text) => `\x1b[${code}m${text}\x1b[0m`;

// Pure presentation: exactly 24 rows, no trailing newline or terminal side effects.
export function renderFrame(state) {
  const border = colour('36', `+${'-'.repeat(BOARD_WIDTH * 2)}+`);
  const active = new Set(activeCells(state.active).map(([x, y]) => `${x},${y}`));
  const rows = state.board.map((row, y) =>
    colour('36', '|') + row.map((cell, x) => active.has(`${x},${y}`)
      ? colour(pieceColours[state.active.type], '[]')
      : cell == null ? ' .' : colour('35', '[]')).join('') + colour('36', '|'));
  const score = String(state.score);
  const scoreLabel = score.length <= 16 ? score : `${score.slice(0, 12)}...`;
  const gameOver = state.status === 'game-over';
  const paused = state.status === 'paused';
  return [
    border,
    ...rows,
    border,
    colour('33', `Score: ${scoreLabel}  ${gameOver ? 'Game over' : paused ? 'Paused' : 'Running'}`),
    colour('32', gameOver ? 'R:restart Q:quit' : paused ? 'P:resume Q:quit' : 'Arrows: move/rotate  P:pause Q:quit'),
  ].join('\n');
}
