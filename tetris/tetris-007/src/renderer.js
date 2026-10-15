const { BOARD_WIDTH, BOARD_HEIGHT } = require('./game');

const colour = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', cyan: '\x1b[36m', blue: '\x1b[34m',
  green: '\x1b[32m', yellow: '\x1b[33m', magenta: '\x1b[35m', red: '\x1b[31m',
};

function paint(text, ...styles) {
  return `${styles.join('')}${text}${colour.reset}`;
}

function visibleBoard(game) {
  const board = (game?.board || Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null)))
    .map(row => [...row]);
  if (game?.piece) {
    const { piece } = game;
    piece.shape.forEach((row, y) => row.forEach((filled, x) => {
      const boardX = piece.x + x;
      const boardY = piece.y + y;
      if (filled && boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
        board[boardY][boardX] = piece.colour;
      }
    }));
  }
  return board;
}

function renderScreen(game = {}) {
  const boardRows = visibleBoard(game).map(row => `${paint('|', colour.blue)}${row.map(cell =>
    cell ? paint('█', colour[cell]) : paint('·', colour.dim)).join('')}${paint('|', colour.blue)}`);
  const status = game.status || 'Ready';
  const statusColour = status === 'Game over' ? colour.red : colour.green;
  return [
    paint('          TERMINAL TETRIS', colour.bold, colour.magenta),
    paint(`+${'-'.repeat(BOARD_WIDTH)}+`, colour.cyan),
    ...boardRows,
    paint(`+${'-'.repeat(BOARD_WIDTH)}+`, colour.cyan),
    `${paint('Score:', colour.yellow)} ${game.score || 0}   ${paint('Lines:', colour.green)} ${game.lines || 0}`,
    `${paint('Controls:', colour.cyan)} ${paint('arrows', colour.blue)} move, ${paint('up', colour.magenta)} rotates, ${paint('q', colour.red)} quits`,
    `${paint('Status:', statusColour)} ${paint(status, statusColour, colour.bold)}`, 
  ].join('\n');
}

function draw(screen = renderScreen()) {
  process.stdout.write(`\x1b[2J\x1b[H${screen}`);
}

module.exports = { BOARD_HEIGHT, BOARD_WIDTH, draw, renderScreen, visibleBoard };
