"use strict";

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

/**
 * Render one complete game frame. Callers redraw this string in place rather
 * than appending frames, which keeps terminal output bounded.
 */
function renderFrame({ score = 0, board, activePiece } = {}) {
  const settled = board || Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
  const activeCells = new Set((activePiece?.cells || []).map(({ x, y }) => `${x},${y}`));
  const boardRows = Array.from({ length: BOARD_HEIGHT }, (_, y) => {
    const cells = Array.from({ length: BOARD_WIDTH }, (_, x) =>
      activeCells.has(`${x},${y}`) || settled[y]?.[x] ? "█" : " "
    ).join("");
    return `│${cells}│`;
  });
  const rows = [
    `┌${"─".repeat(BOARD_WIDTH)}┐  TETRIS  Score: ${score}`,
    ...boardRows,
    `└${"─".repeat(BOARD_WIDTH)}┘`,
    "←/→ move  ↑ rotate  ↓ down  Space drop  Q quit"
  ];

  return rows.join("\n");
}

module.exports = { BOARD_HEIGHT, BOARD_WIDTH, renderFrame };
