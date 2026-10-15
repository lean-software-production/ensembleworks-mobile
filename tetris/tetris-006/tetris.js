const WIDTH = 10;
const HEIGHT = 20;
const SHAPES = [
  [[1, 1, 1, 1]],
  [[1, 1], [1, 1]],
  [[0, 1, 0], [1, 1, 1]],
  [[1, 0, 0], [1, 1, 1]],
  [[0, 0, 1], [1, 1, 1]],
  [[0, 1, 1], [1, 1, 0]],
  [[1, 1, 0], [0, 1, 1]],
];
const COLORS = ['cyan', 'yellow', 'magenta', 'blue', 'white', 'green', 'red'];
const ANSI = { cyan: 36, yellow: 33, magenta: 35, blue: 34, white: 37, green: 32, red: 31 };
const board = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(null));
let score = 0;
let lines = 0;
let piece;
let timer;
let ended = false;

function newPiece() {
  const shapeIndex = Math.floor(Math.random() * SHAPES.length);
  piece = { shape: SHAPES[shapeIndex].map(row => [...row]), color: COLORS[shapeIndex], x: Math.floor((WIDTH - SHAPES[shapeIndex][0].length) / 2), y: 0 };
  if (collides(piece.x, piece.y, piece.shape)) finish();
}
function collides(x, y, shape) {
  return shape.some((row, dy) => row.some((cell, dx) => cell && (x + dx < 0 || x + dx >= WIDTH || y + dy >= HEIGHT || (y + dy >= 0 && board[y + dy][x + dx]))));
}
function rotate(shape) {
  return shape[0].map((_, x) => shape.map(row => row[x]).reverse());
}
function lock() {
  piece.shape.forEach((row, dy) => row.forEach((cell, dx) => { if (cell && piece.y + dy >= 0) board[piece.y + dy][piece.x + dx] = piece.color; }));
  let cleared = 0;
  for (let y = HEIGHT - 1; y >= 0; y--) {
    if (board[y].every(Boolean)) { board.splice(y, 1); board.unshift(Array(WIDTH).fill(null)); cleared++; y++; }
  }
  if (cleared) { lines += cleared; score += [0, 100, 300, 500, 800][cleared] * Math.max(1, Math.floor((lines - cleared) / 10) + 1); }
  newPiece();
}
function tick() {
  if (!piece || ended) return;
  if (!collides(piece.x, piece.y + 1, piece.shape)) piece.y++;
  else lock();
  render();
}
function render() {
  const view = board.map(row => row.slice());
  if (piece) piece.shape.forEach((row, dy) => row.forEach((cell, dx) => { const y = piece.y + dy; if (cell && y >= 0 && y < HEIGHT) view[y][piece.x + dx] = piece.color; }));
  const block = color => `\x1b[${ANSI[color]}m██\x1b[0m`;
  const empty = '  ';
  const output = [` TETRIS   Score: ${score}   Lines: ${lines}`, `┌${'──'.repeat(WIDTH)}┐`];
  for (const row of view) output.push(`│${row.map(cell => cell ? block(cell) : empty).join('')}│`);
  output.push(`└${'──'.repeat(WIDTH)}┘`, '←/→ move  ↑ rotate  ↓ drop  q quit');
  if (ended) output[0] = ` GAME OVER   Score: ${score}   Lines: ${lines}`;
  process.stdout.write('\x1b[H\x1b[2J' + output.join('\n') + '\n');
}
function finish() {
  ended = true;
  clearInterval(timer);
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  render();
  process.exitCode = 0;
}
function handleKey(key) {
  if (key === '\u0003' || key === 'q') { clearInterval(timer); if (process.stdin.isTTY) process.stdin.setRawMode(false); process.exit(0); }
  if (ended || !piece) return;
  if (key === '\u001b[A') { const shape = rotate(piece.shape); if (!collides(piece.x, piece.y, shape)) piece.shape = shape; }
  else if (key === '\u001b[D' && !collides(piece.x - 1, piece.y, piece.shape)) piece.x--;
  else if (key === '\u001b[C' && !collides(piece.x + 1, piece.y, piece.shape)) piece.x++;
  else if (key === '\u001b[B') { while (!collides(piece.x, piece.y + 1, piece.shape)) piece.y++; lock(); }
  render();
}

if (!process.stdin.isTTY) {
  console.error('Tetris requires an interactive terminal.');
  process.exit(1);
} else {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', data => handleKey(data.toString()));
  newPiece();
  render();
  timer = setInterval(tick, 700);
}
