"use strict";

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

/**
 * Render one complete game frame. Callers redraw this string in place rather
 * than appending frames, which keeps terminal output bounded.
 */
function renderFrame({ score = 0 } = {}) {
  const emptyRow = `│${" ".repeat(BOARD_WIDTH)}│`;
  const rows = [
    `┌${"─".repeat(BOARD_WIDTH)}┐  TETRIS  Score: ${score}`,
    ...Array.from({ length: BOARD_HEIGHT }, () => emptyRow),
    `└${"─".repeat(BOARD_WIDTH)}┘`,
    "←/→ move  ↑ rotate  ↓ down  Space drop  Q quit"
  ];

  return rows.join("\n");
}

module.exports = { BOARD_HEIGHT, BOARD_WIDTH, renderFrame };
