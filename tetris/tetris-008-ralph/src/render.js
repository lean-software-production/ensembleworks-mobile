import { BOARD_WIDTH, BOARD_HEIGHT, activeCells } from './model.js';
export { BOARD_WIDTH, BOARD_HEIGHT } from './model.js';

export const PALETTE = Object.freeze({
  I: 96, O: 93, T: 95, S: 92, Z: 91, J: 94, L: 33,
});
export const FRAME_ROWS = 24;
export const FRAME_COLUMNS = 63;

// No terminal I/O or state mutation. No final newline: a 24-row terminal
// must not scroll into a 25th row after the controls.
export function renderFrame(game, { color = false } = {}) {
  const style = (text, code) => color ? `\x1b[${code}m${text}\x1b[0m` : text;
  const border = style(`+${'-'.repeat(BOARD_WIDTH * 2)}+`, 90);
  const active = new Map(game?.active
    ? activeCells(game.active).map(([x, y]) => [`${x},${y}`, game.active.type]) : []);
  const rows = Array.from({ length: BOARD_HEIGHT }, (_, y) => {
    const cells = Array.from({ length: BOARD_WIDTH }, (_, x) => {
      const type = active.get(`${x},${y}`) ?? game?.board[y][x];
      return type ? style('[]', PALETTE[type]) : '  ';
    });
    return style('|', 90) + cells.join('') + style('|', 90);
  });
  // Keep even unusually large scores within the board's 22-column width.
  const score = String(game?.score ?? 0);
  const scoreLabel = score.length > 15 ? `${score.slice(0, 14)}…` : score;
  return [
    border,
    ...rows,
    border,
    style(game?.status === 'game-over'
      ? `Game over | Score: ${scoreLabel}`
      : game?.status === 'paused' ? `Paused | Score: ${scoreLabel}` : `Score: ${scoreLabel}`, 97),
    game?.status === 'game-over'
      ? 'Controls: r restart | q quit'
      : game?.status === 'paused'
        ? 'Controls: p resume | q quit'
        : 'Controls: <-/-> move | Up rotate | Down drop | p pause | q quit',
  ].join('\n');
}
