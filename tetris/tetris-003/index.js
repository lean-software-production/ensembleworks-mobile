const { WIDTH, HEIGHT, SHAPES, createBoard, createPiece, movePiece, rotatePiece, lockPiece, clearLines, collides } = require('./game');

const COLORS = { I: 36, O: 33, T: 35, S: 32, Z: 31, J: 34, L: 33 };
const board = createBoard();
let piece;
let score = 0;
let lines = 0;
let gameOver = false;
let timer;

function spawn() {
  const types = Object.keys(SHAPES);
  piece = createPiece(types[Math.floor(Math.random() * types.length)]);
  if (collides(board, piece)) endGame();
}

function draw() {
  const view = board.map(row => row.slice());
  if (!gameOver && piece) piece.matrix.forEach((row, y) => row.forEach((cell, x) => {
    const by = piece.y + y, bx = piece.x + x;
    if (cell && by >= 0 && by < HEIGHT) view[by][bx] = piece.type;
  }));
  let output = '\x1b[H';
  output += `┌${'──'.repeat(WIDTH)}┐\n`;
  for (const row of view) {
    output += '│';
    for (const cell of row) output += cell ? `\x1b[${COLORS[cell]}m██\x1b[0m` : '  ';
    output += '│\n';
  }
  output += `└${'──'.repeat(WIDTH)}┘\nScore: ${score}  Lines: ${lines}\n`;
  output += gameOver ? 'GAME OVER — press Q to quit' : '← → move  ↓ drop  ↑ rotate  Z reverse  Q quit';
  process.stdout.write(output + '\x1b[J');
}

function endGame() {
  gameOver = true;
  clearInterval(timer);
  draw();
}

function step() {
  if (!movePiece(board, piece, 0, 1)) {
    if (!lockPiece(board, piece)) return endGame();
    const cleared = clearLines(board);
    lines += cleared;
    score += ([0, 100, 300, 500, 800][cleared] || cleared * 200);
    spawn();
  }
  draw();
}

function handleKey(key) {
  key = key.toString();
  if (key === '\u0003' || key.toLowerCase() === 'q') return quit();
  if (gameOver) return;
  if (key === '\u001b[D') movePiece(board, piece, -1, 0);
  else if (key === '\u001b[C') movePiece(board, piece, 1, 0);
  else if (key === '\u001b[B') step();
  else if (key === '\u001b[A') rotatePiece(board, piece);
  else if (key.toLowerCase() === 'z') rotatePiece(board, piece, false);
  draw();
}

function quit() {
  clearInterval(timer);
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  process.stdin.pause();
  process.stdout.write('\x1b[?25h\n');
  process.exit(0);
}

if (require.main === module) {
  process.stdout.write('\x1b[2J\x1b[?25l');
  spawn(); draw();
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', handleKey);
  timer = setInterval(step, 700);
  process.on('exit', () => process.stdout.write('\x1b[?25h'));
}
