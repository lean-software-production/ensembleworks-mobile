'use strict';

const EMPTY_CELL = '  ';
const FILLED_CELL = '[]';
const SIDEBAR_GAP = '  ';

function visibleBoard(game) {
  const cells = game.board.map((row) => row.map((cell) => cell !== null));

  for (const [x, y] of game.cellsFor()) {
    if (y >= 0 && y < game.height && x >= 0 && x < game.width) {
      cells[y][x] = true;
    }
  }

  return cells;
}

function sidebarLines(game) {
  return [
    'TETRIS',
    `Score: ${game.score}`,
    `Lines: ${game.lines}`,
    `Level: ${game.level}`,
    game.gameOver ? '*** GAME OVER ***' : 'Status: Playing',
    game.gameOver ? 'Press R to restart' : '',
    '',
    'Controls',
    '\u2190 / A   Move left',
    '\u2192 / D   Move right',
    '\u2193 / S   Soft drop',
    '\u2191 / W   Rotate',
    'Space   Hard drop',
    'R       Restart',
    'Q       Quit',
  ];
}

function renderGame(game) {
  const board = visibleBoard(game);
  const sidebar = sidebarLines(game);
  const border = `+${'-'.repeat(game.width * EMPTY_CELL.length)}+`;
  const lines = [];

  lines.push(`${border}${SIDEBAR_GAP}${sidebar[0]}`);
  for (let y = 0; y < game.height; y += 1) {
    const row = board[y]
      .map((filled) => (filled ? FILLED_CELL : EMPTY_CELL))
      .join('');
    const side = sidebar[y + 1] || '';
    lines.push(`|${row}|${SIDEBAR_GAP}${side}`.trimEnd());
  }
  lines.push(border);

  return lines.join('\n');
}

module.exports = { renderGame };
