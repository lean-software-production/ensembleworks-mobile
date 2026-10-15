"use strict";

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
// The controls line is the widest fixed part of a normal frame. A terminal
// this wide can display every frame without wrapping.
const FRAME_MIN_COLUMNS = 53;
const FRAME_ROWS = 24;

function scoreText(score) {
  // Keep the header on one line even if a caller supplies an impractically
  // large score. Normal game scores are shown in full.
  return String(score).slice(0, FRAME_MIN_COLUMNS - "┌──────────┐  TETRIS  Score: ".length);
}

function renderSizeWarning({ rows = 0, columns = 0 } = {}) {
  const availableRows = Math.max(0, Math.floor(Number(rows) || 0));
  const availableColumns = Math.max(0, Math.floor(Number(columns) || 0));
  if (availableRows === 0 || availableColumns === 0) return "";
  const message = `Terminal too small — need ${FRAME_MIN_COLUMNS} columns x ${FRAME_ROWS} rows`;
  return message.slice(0, availableColumns);
}

/**
 * Render one complete game frame. Callers redraw this string in place rather
 * than appending frames, which keeps terminal output bounded.
 */
function renderFrame({ score = 0, board, activePiece, gameOver = false } = {}) {
  const settled = board || Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
  const activeCells = new Set((activePiece?.cells || []).map(({ x, y }) => `${x},${y}`));
  const boardRows = Array.from({ length: BOARD_HEIGHT }, (_, y) => {
    const cells = Array.from({ length: BOARD_WIDTH }, (_, x) =>
      activeCells.has(`${x},${y}`) || settled[y]?.[x] ? "█" : " "
    ).join("");
    return `│${cells}│`;
  });
  const rows = [
    `┌${"─".repeat(BOARD_WIDTH)}┐  TETRIS  Score: ${scoreText(score)}`,
    ...boardRows,
    `└${"─".repeat(BOARD_WIDTH)}┘`,
    "←/→ move  ↑ rotate  ↓ down  Space drop  Q/Ctrl-C quit",
    ...(gameOver ? ["GAME OVER — Q quit"] : [])
  ];

  return rows.join("\n");
}

module.exports = {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  FRAME_MIN_COLUMNS,
  FRAME_ROWS,
  renderFrame,
  renderSizeWarning
};
