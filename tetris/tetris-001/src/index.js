'use strict';

const { TetrisGame } = require('./game');
const { renderGame } = require('./renderer');

const CLEAR_SCREEN = '\u001b[2J\u001b[H';
const CURSOR_HOME = '\u001b[H';
const CLEAR_TO_END = '\u001b[J';
const HIDE_CURSOR = '\u001b[?25l';
const SHOW_CURSOR = '\u001b[?25h';

function gravityDelay(level) {
  return Math.max(100, 750 - ((level - 1) * 60));
}

function startInteractiveGame({ input = process.stdin, output = process.stdout } = {}) {
  const game = new TetrisGame();

  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== 'function') {
    output.write(`${renderGame(game)}\n`);
    return;
  }

  const wasRaw = input.isRaw;
  let gravityTimer = null;
  let stopped = false;

  const draw = (clear = false) => {
    output.write(`${clear ? CLEAR_SCREEN : CURSOR_HOME}${renderGame(game)}${CLEAR_TO_END}`);
  };

  const scheduleGravity = () => {
    clearTimeout(gravityTimer);
    if (stopped || game.gameOver) return;

    gravityTimer = setTimeout(() => {
      game.tick();
      draw();
      scheduleGravity();
    }, gravityDelay(game.level));
  };

  const shutdown = (exitCode = 0) => {
    if (stopped) return;
    stopped = true;
    clearTimeout(gravityTimer);
    input.removeListener('data', handleInput);
    input.pause();
    input.setRawMode(wasRaw);
    output.write(`${SHOW_CURSOR}\n`);
    process.exitCode = exitCode;
  };

  const restart = () => {
    game.reset();
    draw();
    scheduleGravity();
  };

  const handleKey = (key) => {
    switch (key) {
      case '\u0003':
        shutdown(130);
        return;
      case 'q':
      case 'Q':
        shutdown();
        return;
      case 'r':
      case 'R':
        restart();
        return;
      case '\u001b[D':
      case 'a':
      case 'A':
        game.moveLeft();
        break;
      case '\u001b[C':
      case 'd':
      case 'D':
        game.moveRight();
        break;
      case '\u001b[B':
      case 's':
      case 'S':
        if (!game.moveDown()) scheduleGravity();
        break;
      case '\u001b[A':
      case 'w':
      case 'W':
        game.rotate();
        break;
      case ' ':
        game.hardDrop();
        scheduleGravity();
        break;
      default:
        return;
    }
    draw();
  };

  const handleInput = (chunk) => {
    const keys = String(chunk).match(/\u001b\[[ABCD]|./gs) || [];
    for (const key of keys) {
      if (stopped) break;
      handleKey(key);
    }
  };

  input.setEncoding('utf8');
  input.setRawMode(true);
  input.resume();
  input.on('data', handleInput);
  process.once('SIGINT', () => shutdown(130));
  process.once('SIGTERM', () => shutdown(143));
  process.once('exit', () => {
    if (!stopped) {
      clearTimeout(gravityTimer);
      input.setRawMode(wasRaw);
      output.write(SHOW_CURSOR);
    }
  });

  output.write(HIDE_CURSOR);
  draw(true);
  scheduleGravity();
}

if (require.main === module) startInteractiveGame();

module.exports = { gravityDelay, startInteractiveGame };
