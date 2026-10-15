const WIDTH = 10;
const HEIGHT = 20;
const SHAPES = [
  [[1, 1, 1, 1]], [[1, 0, 0], [1, 1, 1]], [[0, 0, 1], [1, 1, 1]],
  [[1, 1], [1, 1]], [[0, 1, 1], [1, 1, 0]], [[0, 1, 0], [1, 1, 1]],
  [[1, 1, 0], [0, 1, 1]],
];

function createGame(random = Math.random) {
  const game = { board: Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(0)), score: 0, over: false, piece: null };
  spawn(game, random);
  return game;
}

function spawn(game, random = Math.random) {
  const shape = SHAPES[Math.floor(random() * SHAPES.length)].map(row => [...row]);
  game.piece = { shape, x: Math.floor((WIDTH - shape[0].length) / 2), y: 0 };
  if (collides(game, game.piece.x, game.piece.y, shape)) game.over = true;
}

function collides(game, x, y, shape = game.piece.shape) {
  return shape.some((row, dy) => row.some((cell, dx) => cell &&
    (x + dx < 0 || x + dx >= WIDTH || y + dy >= HEIGHT || (y + dy >= 0 && game.board[y + dy][x + dx]))));
}

function lock(game, random) {
  const { shape, x, y } = game.piece;
  shape.forEach((row, dy) => row.forEach((cell, dx) => { if (cell && y + dy >= 0) game.board[y + dy][x + dx] = 1; }));
  const remaining = game.board.filter(row => row.some(cell => !cell));
  const cleared = HEIGHT - remaining.length;
  game.board = [...Array.from({ length: cleared }, () => Array(WIDTH).fill(0)), ...remaining];
  game.score += [0, 100, 300, 500, 800][cleared] || cleared * 200;
  spawn(game, random);
}

function act(game, key, random = Math.random) {
  if (game.over) return;
  const piece = game.piece;
  if (key === 'left' && !collides(game, piece.x - 1, piece.y)) piece.x--;
  else if (key === 'right' && !collides(game, piece.x + 1, piece.y)) piece.x++;
  else if (key === 'down') {
    if (!collides(game, piece.x, piece.y + 1)) { piece.y++; game.score++; }
    else lock(game, random);
  } else if (key === 'drop') {
    while (!collides(game, piece.x, piece.y + 1)) piece.y++;
    lock(game, random);
  } else if (key === 'rotate') {
    const rotated = piece.shape[0].map((_, x) => piece.shape.map(row => row[x]).reverse());
    if (!collides(game, piece.x, piece.y, rotated)) piece.shape = rotated;
  } else if (key === 'tick') {
    if (!collides(game, piece.x, piece.y + 1)) piece.y++;
    else lock(game, random);
  }
}

function render(game = createGame(() => 0.3)) {
  const cells = game.board.map(row => [...row]);
  if (game.piece && !game.over) game.piece.shape.forEach((row, dy) => row.forEach((cell, dx) => {
    const y = game.piece.y + dy, x = game.piece.x + dx;
    if (cell && y >= 0 && y < HEIGHT && x >= 0 && x < WIDTH) cells[y][x] = 2;
  }));
  const border = `+${'-'.repeat(WIDTH * 2)}+`;
  const rows = cells.map(row => `|${row.map(cell => cell ? '[]' : '  ').join('')}|`);
  return [
    `TETRIS  Score: ${game.score}${game.over ? '  GAME OVER' : ''}`,
    border, ...rows, border,
    '←/a →/d move  ↑/w rotate  ↓/s soft drop  space hard drop  q quit',
  ].join('\n');
}

function start() {
  const game = createGame();
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    process.stdout.write(`${render(game)}\n`);
    return;
  }
  const draw = () => process.stdout.write('\x1b[H\x1b[2J' + render(game));
  process.stdin.setRawMode(true);
  process.stdin.resume();
  draw();
  const timer = setInterval(() => { act(game, 'tick'); draw(); }, 700);
  process.stdin.on('data', (buffer) => {
    const key = buffer.toString();
    if (key === 'q' || buffer[0] === 3) {
      clearInterval(timer);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      process.exit(0);
    }
    const actions = { '\u001b[D': 'left', '\u001b[C': 'right', '\u001b[A': 'rotate', '\u001b[B': 'down', a: 'left', d: 'right', w: 'rotate', s: 'down', ' ': 'drop' };
    act(game, actions[key]);
    draw();
  });
}

if (require.main === module) start();
module.exports = { render, createGame, act, collides };
