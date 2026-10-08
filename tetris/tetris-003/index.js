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

function createGame(random = Math.random) {
  const board = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(0));
  let piece;
  let score = 0;
  let lines = 0;
  let gameOver = false;

  function collides(x, y, shape) {
    return shape.some((row, dy) => row.some((cell, dx) => cell &&
      (x + dx < 0 || x + dx >= WIDTH || y + dy >= HEIGHT ||
        (y + dy >= 0 && board[y + dy][x + dx]))));
  }
  function spawn() {
    const shape = SHAPES[Math.floor(random() * SHAPES.length)].map(row => [...row]);
    piece = { shape, x: Math.floor((WIDTH - shape[0].length) / 2), y: 0 };
    if (collides(piece.x, piece.y, piece.shape)) gameOver = true;
  }
  function lock() {
    piece.shape.forEach((row, dy) => row.forEach((cell, dx) => {
      if (cell && piece.y + dy >= 0) board[piece.y + dy][piece.x + dx] = 1;
    }));
    let cleared = 0;
    for (let y = HEIGHT - 1; y >= 0; y--) {
      if (board[y].every(Boolean)) {
        board.splice(y, 1);
        board.unshift(Array(WIDTH).fill(0));
        cleared++;
        y++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += [0, 100, 300, 500, 800][cleared] || cleared * 200;
    }
    spawn();
  }
  function move(dx, dy) {
    if (gameOver) return false;
    if (!collides(piece.x + dx, piece.y + dy, piece.shape)) {
      piece.x += dx;
      piece.y += dy;
      return true;
    }
    if (dy > 0) lock();
    return false;
  }
  function rotate() {
    if (gameOver) return false;
    const rotated = piece.shape[0].map((_, x) => piece.shape.map(row => row[x]).reverse());
    if (collides(piece.x, piece.y, rotated)) return false;
    piece.shape = rotated;
    return true;
  }
  function tick() { return move(0, 1); }
  function getSnapshot() {
    const display = board.map(row => [...row]);
    if (piece) piece.shape.forEach((row, dy) => row.forEach((cell, dx) => {
      const y = piece.y + dy, x = piece.x + dx;
      if (cell && y >= 0 && y < HEIGHT) display[y][x] = 1;
    }));
    return { board: display, score, lines, gameOver };
  }

  spawn();
  return { move, rotate, tick, getSnapshot };
}

function render(game) {
  const { board, score, lines, gameOver } = game.getSnapshot();
  const output = ['┌' + '──'.repeat(WIDTH) + '┐'];
  board.forEach(row => output.push('│' + row.map(cell => cell ? '██' : '  ').join('') + '│'));
  output.push('└' + '──'.repeat(WIDTH) + '┘');
  output.push(`Score: ${score}   Lines: ${lines}`);
  output.push(gameOver ? 'GAME OVER — press Q to quit' : '←/A left  →/D right  ↓/S down  ↑/W rotate  Q quit');
  process.stdout.write('\x1b[H\x1b[2J' + output.join('\n') + '\n');
}

function runTerminal() {
  const game = createGame();
  function quit() {
    clearInterval(timer);
    if (process.stdin.isTTY) { process.stdin.setRawMode(false); process.stdin.pause(); }
    process.stdout.write('\x1b[?25h\n');
    process.exit(0);
  }
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdout.write('\x1b[?25l');
  process.stdin.on('data', key => {
    if (key === '\u0003' || key.toLowerCase() === 'q') return quit();
    if (game.getSnapshot().gameOver) return;
    if (key === '\u001b[A' || key.toLowerCase() === 'w') game.rotate();
    else if (key === '\u001b[B' || key.toLowerCase() === 's') game.move(0, 1);
    else if (key === '\u001b[C' || key.toLowerCase() === 'd') game.move(1, 0);
    else if (key === '\u001b[D' || key.toLowerCase() === 'a') game.move(-1, 0);
    render(game);
  });
  const timer = setInterval(() => { game.tick(); render(game); }, 700);
  render(game);
}

if (require.main === module) runTerminal();
module.exports = { createGame };
