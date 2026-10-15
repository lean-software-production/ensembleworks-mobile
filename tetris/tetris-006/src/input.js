'use strict';

const {
  advanceGame, moveLeft, moveRight, rotateClockwise,
} = require('./game');

const KEY_SEQUENCES = Object.freeze({
  '\u001b[D': 'left',
  '\u001b[C': 'right',
  '\u001b[A': 'rotate',
  '\u001b[B': 'down',
  p: 'pause',
  r: 'restart',
  q: 'quit',
});

const SEQUENCES = Object.keys(KEY_SEQUENCES);

/**
 * Decode terminal key bytes incrementally and apply the documented actions.
 * Escape sequences may be split between writes; incomplete prefixes are held
 * until their remaining bytes arrive. Unknown bytes are discarded safely.
 */
function createInputAdapter(game, gravity, { onChange = () => {}, onQuit = () => {} } = {}) {
  if (!game || !gravity || typeof gravity.pause !== 'function' || typeof gravity.resume !== 'function'
    || typeof gravity.restart !== 'function') {
    throw new TypeError('game and gravity controller are required');
  }
  if (typeof onChange !== 'function' || typeof onQuit !== 'function') {
    throw new TypeError('input callbacks must be functions');
  }

  let pending = '';

  function dispatch(action) {
    let changed = false;
    switch (action) {
      case 'left': changed = moveLeft(game); break;
      case 'right': changed = moveRight(game); break;
      case 'rotate': changed = rotateClockwise(game); break;
      case 'down':
        if (!game.gameOver && !game.paused) {
          advanceGame(game);
          changed = true;
        }
        break;
      case 'pause':
        changed = game.paused ? gravity.resume() : gravity.pause();
        break;
      case 'restart':
        if (game.gameOver) {
          gravity.restart();
          changed = true;
        }
        break;
      case 'quit':
        onQuit();
        return true;
      default: return false;
    }
    if (changed) onChange();
    return changed;
  }

  function write(chunk) {
    pending += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    const actions = [];

    while (pending) {
      const sequence = SEQUENCES.find((candidate) => pending.startsWith(candidate));
      if (sequence) {
        pending = pending.slice(sequence.length);
        const action = KEY_SEQUENCES[sequence];
        dispatch(action);
        actions.push(action);
        continue;
      }
      if (SEQUENCES.some((candidate) => candidate.startsWith(pending))) break;
      pending = pending.slice(1);
    }
    return actions;
  }

  return { write };
}

module.exports = { KEY_SEQUENCES, createInputAdapter };
