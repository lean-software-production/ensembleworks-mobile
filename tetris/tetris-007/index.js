const { createGame, move, turn, tick, drop } = require('./src/game');
const { draw, renderScreen } = require('./src/renderer');
const { KeyDecoder } = require('./src/input');

const game = createGame();
const input = new KeyDecoder();
let timer;
let cleanedUp = false;

function render() {
  draw(renderScreen(game));
}

function cleanup(exitCode = 0) {
  if (cleanedUp) return;
  cleanedUp = true;
  if (timer) clearInterval(timer);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
    process.stdin.pause();
  }
  process.stdout.write('\x1b[0m\x1b[?25h');
  process.exit(exitCode);
}

function handleKey(key) {
  if (key === 'q' || key === '\u0003') return cleanup();
  if (key === '\u001b[A' || key === 'w') turn(game);
  else if (key === '\u001b[B' || key === 's') tick(game);
  else if (key === '\u001b[C' || key === 'd') move(game, 1);
  else if (key === '\u001b[D' || key === 'a') move(game, -1);
  else if (key === ' ') drop(game);
  render();
}

render();

if (process.stdin.isTTY) {
  process.stdout.write('\x1b[?25l');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', chunk => {
    for (const key of input.push(chunk)) handleKey(key);
  });
  process.on('SIGTERM', () => cleanup());
  timer = setInterval(() => {
    tick(game);
    render();
  }, 700);
}
