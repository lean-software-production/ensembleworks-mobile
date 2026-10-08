'use strict';

const { TetrisGame } = require('./TetrisGame');
const { TerminalController } = require('./TerminalController');

const EMPTY_CELL = ' ';

/**
 * Build the entire visible game in exactly 24 rows: a 20-row board inside
 * borders, followed by a status row and a controls row.  Keeping this a pure
 * function makes each repaint replace the previous frame rather than append
 * a scrolling transcript.
 */
function renderGame(game) {
  const visibleCells = new Map(
    game.visibleCells().map(({ x, y, type }) => [`${x},${y}`, type]),
  );
  const center = (text) => text.slice(0, game.width).padStart(
    Math.floor((game.width + text.length) / 2),
  ).padEnd(game.width);
  const rows = [`┌${'─'.repeat(game.width)}┐`];
  const messageRows = game.gameOver
    ? new Map([[Math.floor(game.height / 2) - 1, center('GAME OVER!')], [Math.floor(game.height / 2), center('R: restart')]])
    : new Map();

  for (let y = 0; y < game.height; y += 1) {
    const message = messageRows.get(y);
    const cells = message || Array.from({ length: game.width }, (_, x) => (
      visibleCells.get(`${x},${y}`) || EMPTY_CELL
    )).join('');
    rows.push(`│${cells}│`);
  }

  rows.push(`└${'─'.repeat(game.width)}┘`);
  rows.push(`Score: ${game.score}  Lines: ${game.lines}  Level: ${game.level}`);
  rows.push('←/→ move  ↓ soft drop  W rotate  Space drop  Q quit');
  return rows.join('\n');
}

function repaint(output, game) {
  // Home after clearing so every frame occupies the same 24 terminal rows.
  output.write(`\u001b[?25l\u001b[2J\u001b[H${renderGame(game)}`);
}

function startGame() {
  const game = new TetrisGame();
  let controller;
  const exitGame = () => {
    controller.stop();
    process.removeListener('SIGINT', exitGame);
    process.removeListener('SIGTERM', exitGame);
    process.stdout.write('\u001b[0m\u001b[?25h\u001b[2J\u001b[H');
    process.exit(0);
  };

  controller = new TerminalController({
    game,
    onUpdate: (updatedGame) => repaint(process.stdout, updatedGame),
    onQuit: exitGame,
  });
  controller.start();
  process.on('SIGINT', exitGame);
  process.on('SIGTERM', exitGame);
  return controller;
}

if (require.main === module) {
  try {
    startGame();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { TetrisGame, TerminalController, renderGame, repaint, startGame };
