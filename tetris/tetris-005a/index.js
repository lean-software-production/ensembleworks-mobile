'use strict';

const { TetrisGame } = require('./game');

const colours = { I: 36, J: 34, L: 33, O: 93, S: 32, T: 35, Z: 31 };

function block(value) {
  return value ? `\x1b[${colours[value]}m██\x1b[0m` : '  ';
}

function createTetrisApp({
  stdin = process.stdin,
  stdout = process.stdout,
  gameFactory = () => new TetrisGame(),
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  exit = code => process.exit(code)
} = {}) {
  let game = gameFactory();
  let timer = null;
  let terminalRestored = false;

  function fallDelay() {
    return Math.max(120, 700 - (game.level() - 1) * 55);
  }

  function render() {
    const rows = [
      '\x1b[1m              TERMINAL TETRIS\x1b[0m',
      '┌────────────────────┐',
      ...game.cells().map(row => `│${row.map(block).join('')}│`),
      '└────────────────────┘',
      ` Score: ${game.score}   Lines: ${game.lines}   Level: ${game.level()}`,
      game.over
        ? ' GAME OVER — press r to restart, q to quit'
        : ' ←/→ move  ↑ rotate  ↓ soft drop  space hard drop  q quit'
    ];
    // Clear every row before painting it: messages and scores may get shorter.
    stdout.write(`\x1b[H${rows.map(row => `\x1b[2K${row}`).join('\n')}`);
  }

  function cancelTick() {
    if (timer !== null) clearTimeoutFn(timer);
    timer = null;
  }

  function scheduleTick(reset = false) {
    if (game.over) {
      cancelTick();
      return;
    }
    // Inputs that only move or rotate must not postpone a pending gravity tick.
    if (timer !== null && !reset) return;
    cancelTick();
    timer = setTimeoutFn(() => {
      timer = null;
      game.tick();
      render();
      scheduleTick(true);
    }, fallDelay());
  }

  function restart() {
    game = gameFactory();
    render();
    scheduleTick(true);
  }

  function restoreTerminal() {
    if (terminalRestored) return;
    terminalRestored = true;
    cancelTick();
    if (stdin.isTTY) stdin.setRawMode(false);
    stdout.write('\x1b[0m\x1b[?25h\x1b[?1049l');
  }

  function quit() {
    restoreTerminal();
    exit(0);
  }

  function handleKey(key) {
    if (key === '\u0003' || key === 'q') return quit();
    if (key === 'r' && game.over) return restart();
    if (game.over) return;

    let resetGravity = false;
    if (key === '\x1b[D' || key === 'a') game.move(-1, 0);
    else if (key === '\x1b[C' || key === 'd') game.move(1, 0);
    else if (key === '\x1b[A' || key === 'w') game.rotate();
    else if (key === '\x1b[B' || key === 's') game.move(0, 1);
    else if (key === ' ') {
      game.drop();
      // A new piece (and possibly level) needs a fresh gravity interval.
      resetGravity = true;
    } else return;

    render();
    scheduleTick(resetGravity);
  }

  return {
    render,
    scheduleTick,
    restart,
    restoreTerminal,
    quit,
    handleKey,
    start() {
      render();
      scheduleTick(true);
    },
    get game() { return game; },
    get timer() { return timer; }
  };
}

function run() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('Tetris needs an interactive terminal. Run `npm start` from a terminal.');
    process.exit(1);
  }

  const app = createTetrisApp();
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdout.write('\x1b[?1049h\x1b[2J\x1b[H\x1b[?25l');
  const onData = key => app.handleKey(key);
  process.stdin.on('data', onData);
  process.once('SIGTERM', () => app.quit());
  process.once('SIGINT', () => app.quit());
  process.once('exit', () => app.restoreTerminal());
  app.start();
}

if (require.main === module) run();

module.exports = { createTetrisApp, block };
