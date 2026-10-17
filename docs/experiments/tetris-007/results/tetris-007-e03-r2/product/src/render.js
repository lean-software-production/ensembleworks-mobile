// Snapshot contract: 20x10 board of null or piece types; optional active piece
// contains absolute {x, y} cells and a type. Rendering never changes the snapshot.
export const PIECE_COLOURS = Object.freeze({
  I: 96, O: 93, T: 95, S: 92, Z: 91, J: 94, L: 33,
});
const RESET = '\x1b[0m';
export const emptyBoard = () => Array.from({ length: 20 }, () => Array(10).fill(null));

export function stripAnsi(text) {
  return text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
}

// Splitting deliberately counts a trailing newline as an extra terminal row.
export function measureFrame(frame) {
  const rows = stripAnsi(frame).split('\n');
  return { rows: rows.length, columns: Math.max(...rows.map(row => [...row].length)) };
}

export function renderFrame({ board, active = null, score = 0, phase = 'running' }, { colour = false } = {}) {
  const paint = (text, code) => colour ? `\x1b[${code}m${text}${RESET}` : text;
  const cells = board.map(row => [...row]);
  for (const { x, y } of active?.cells ?? []) cells[y][x] = active.type;
  const border = paint(`+${'-'.repeat(20)}+`, 36);
  const lines = [border];
  for (const row of cells) {
    lines.push(paint('|', 36) + row.map(type => type
      ? paint(`${type}${type}`, PIECE_COLOURS[type]) : '  ').join('') + paint('|', 36));
  }
  lines.push(border);
  const label = { running: 'Running', paused: 'Paused', 'game over': 'Game over', gameOver: 'Game over' }[phase] ?? 'Running';
  const scoreText = String(score);
  const boundedScore = scoreText.length <= 24 ? scoreText : `${scoreText.slice(0, 20)}...`;
  lines.push(paint(`Score: ${boundedScore} | ${label}`, 93));
  lines.push(paint('Arrows: move/rotate/drop  P:pause  R:restart  Q:quit', 90));
  return lines.join('\n') + (colour ? RESET : '');
}
