const readline = require('readline');

const W = 10, H = 20;
const shapes = [
  [[1, 1, 1, 1]], [[1, 1], [1, 1]], [[0, 1, 0], [1, 1, 1]],
  [[1, 0, 0], [1, 1, 1]], [[0, 0, 1], [1, 1, 1]],
  [[0, 1, 1], [1, 1, 0]], [[1, 1, 0], [0, 1, 1]]
];
let board, piece, score, lines, over, timer;
const emptyBoard = () => Array.from({ length: H }, () => Array(W).fill(0));
function spawn() {
  const shape = shapes[Math.floor(Math.random() * shapes.length)].map(row => row.slice());
  piece = { shape, x: Math.floor((W - shape[0].length) / 2), y: 0 };
  if (collides(piece.x, piece.y, shape)) endGame();
}
function collides(x, y, shape) {
  return shape.some((row, dy) => row.some((cell, dx) => cell &&
    (x + dx < 0 || x + dx >= W || y + dy >= H || (y + dy >= 0 && board[y + dy][x + dx]))));
}
function lock() {
  piece.shape.forEach((row, dy) => row.forEach((cell, dx) => {
    if (cell && piece.y + dy >= 0) board[piece.y + dy][piece.x + dx] = 1;
  }));
  let cleared = 0;
  board = board.filter(row => { if (row.every(Boolean)) { cleared++; return false; } return true; });
  while (board.length < H) board.unshift(Array(W).fill(0));
  lines += cleared;
  score += [0, 100, 300, 500, 800][cleared] || cleared * 200;
  spawn();
}
function rotate(shape) {
  return shape[0].map((_, x) => shape.map(row => row[x]).reverse());
}
function render() {
  const view = board.map(row => row.slice());
  if (piece) piece.shape.forEach((row, dy) => row.forEach((cell, dx) => {
    const y = piece.y + dy, x = piece.x + dx;
    if (cell && y >= 0 && y < H && x >= 0 && x < W) view[y][x] = 2;
  }));
  const out = ['┌' + '──'.repeat(W) + '┐'];
  for (const row of view) out.push('│' + row.map(c => c ? (c === 2 ? '[]' : '██') : '  ').join('') + '│');
  out.push(`Score: ${score}   Lines: ${lines}`);
  out.push('← → move   ↑ rotate   ↓ drop   Space hard drop   Q quit');
  if (over) out.push('GAME OVER — press R to restart or Q to quit');
  process.stdout.write('\x1b[H\x1b[2J' + out.join('\n') + '\n');
}
function endGame() { over = true; clearInterval(timer); }
function start() {
  board = emptyBoard(); score = 0; lines = 0; over = false;
  spawn(); timer = setInterval(() => { if (!over) move(0, 1); }, 650); render();
}
function move(dx, dy) {
  if (collides(piece.x + dx, piece.y + dy, piece.shape)) {
    if (dy > 0) lock();
  } else {
    piece.x += dx;
    piece.y += dy;
    if (dy > 0) score += dy;
  }
  render();
}
function quit() { clearInterval(timer); process.stdout.write('\x1b[0m\n'); process.exit(0); }
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.on('keypress', (str, key) => {
  if (key && key.ctrl && key.name === 'c' || str === 'q' || str === 'Q') return quit();
  if (over) { if (str === 'r' || str === 'R') start(); return; }
  if (key && key.name === 'left') move(-1, 0);
  else if (key && key.name === 'right') move(1, 0);
  else if (key && key.name === 'down') move(0, 1);
  else if (key && key.name === 'up') {
    const turned = rotate(piece.shape);
    if (!collides(piece.x, piece.y, turned)) piece.shape = turned;
    render();
  } else if (key && key.name === 'space') {
    let distance = 0;
    while (!collides(piece.x, piece.y + 1, piece.shape)) {
      piece.y++;
      distance++;
    }
    score += distance * 2;
    lock(); render();
  }
});
start();
