'use strict';

const { TetrisGame } = require('./game');

const game = new TetrisGame();
const colours = { I: 36, J: 34, L: 33, O: 93, S: 32, T: 35, Z: 31 };
let timer;

function block(value) {
  return value ? `\x1b[${colours[value]}m██\x1b[0m` : '  ';
}

function render() {
  const board = game.cells();
  const rows = [
    '\x1b[1m              TERMINAL TETRIS\x1b[0m',
    '┌────────────────────┐',
    ...board.map(row => `│${row.map(block).join('')}│`),
    '└────────────────────┘',
    ` Score: ${game.score}   Lines: ${game.lines}   Level: ${game.level()}`
  ];
  rows.push(game.over ? ' GAME OVER — press r to restart, q to quit' : ' ←/→ move  ↑ rotate  ↓ soft drop  space hard drop  q quit');
  process.stdout.write('\x1b[H\x1b[2J' + rows.join('\n') + '\n');
}

function restart() {
  Object.assign(game, new TetrisGame());
  resetTimer();
  render();
}

function resetTimer() {
  clearInterval(timer);
  timer = setInterval(() => {
    game.tick();
    render();
    if (game.over) clearInterval(timer);
  }, Math.max(120, 700 - (game.level() - 1) * 55));
}

function quit() {
  clearInterval(timer);
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  process.stdout.write('\x1b[0m\n');
  process.exit(0);
}

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error('Tetris needs an interactive terminal. Run `npm start` from a terminal.');
  process.exit(1);
}

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on('data', key => {
  if (key === '\u0003' || key === 'q') return quit();
  if (key === 'r' && game.over) return restart();
  if (game.over) return;
  if (key === '\x1b[D' || key === 'a') game.move(-1, 0);
  else if (key === '\x1b[C' || key === 'd') game.move(1, 0);
  else if (key === '\x1b[A' || key === 'w') game.rotate();
  else if (key === '\x1b[B' || key === 's') game.move(0, 1);
  else if (key === ' ') game.drop();
  render();
});
process.on('SIGTERM', quit);
process.on('SIGINT', quit);

render();
resetTimer();
