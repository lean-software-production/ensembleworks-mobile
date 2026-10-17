const RESET = '\x1b[0m';
const COLORS = { I: 96, O: 93, T: 95, J: 94, L: 91, S: 92, Z: 31 };

/** Pure rendering: no terminal queries, writes, or snapshot mutations. */
export function renderFrame(snapshot, { color = false } = {}) {
  const paint = (text, code) => color ? `\x1b[${code}m${text}${RESET}` : text;
  const border = paint(`+${'-'.repeat(20)}+`, 96);
  const rows = snapshot.board.map(row =>
    paint('|', 96) + row.map(cell => cell
      ? paint(`${cell}${cell}`, COLORS[cell]) : ' .').join('') + paint('|', 96));
  const score = String(snapshot.score);
  const compactScore = score.length <= 18 ? score : Number(snapshot.score).toExponential(6);
  const phase = { running: 'Running', paused: 'Paused', 'game-over': 'Game over' }[snapshot.phase];
  return [border, ...rows, border,
    paint(`Score: ${compactScore} | ${phase}`, 93),
    paint('Left/Right:move Up:rotate Down:drop P:pause R:restart Q:quit', 92)
  ].join('\n');
}
