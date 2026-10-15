'use strict';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

/**
 * Render a complete Tetris frame. Every board cell occupies two columns so
 * the conventional 10 by 20 playfield remains easy to read in a terminal.
 * The returned string has exactly 24 visible rows.
 */
function renderFrame(state = {}) {
  const board = state.board || emptyBoard();
  validateBoard(board);

  const score = Number.isFinite(state.score) ? state.score : 0;
  const rows = [`┌${'─'.repeat(BOARD_WIDTH * 2)}┐`];

  const activeCells = new Set(
    (state.activePiece ? state.activePiece.cells : []).map(
      ({ x, y }) => `${state.activePiece.x + x},${state.activePiece.y + y}`,
    ),
  );

  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    const cells = board[y].map((filled, x) => {
      if (activeCells.has(`${x},${y}`)) return '░░';
      return filled ? '██' : '  ';
    }).join('');
    rows.push(`│${cells}│`);
  }

  rows.push(`└${'─'.repeat(BOARD_WIDTH * 2)}┘`);
  rows.push(`Score: ${score}`);
  rows.push('Controls: ← → move  ↑ rotate  ↓ drop  q quit');
  return rows.join('\n');
}

function emptyBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () =>
    Array(BOARD_WIDTH).fill(false),
  );
}

function validateBoard(board) {
  if (board.length !== BOARD_HEIGHT || board.some((row) => row.length !== BOARD_WIDTH)) {
    throw new RangeError(`Board must be ${BOARD_WIDTH} columns by ${BOARD_HEIGHT} rows`);
  }
}

module.exports = { BOARD_WIDTH, BOARD_HEIGHT, emptyBoard, renderFrame, validateBoard };
