'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { Board } = require('../src/board');
const { Game } = require('../src/game');
const { Piece } = require('../src/pieces');

class PieceQueue {
  constructor(...pieces) {
    this.pieces = pieces;
    this.index = 0;
  }

  next() {
    const piece = this.pieces[Math.min(this.index, this.pieces.length - 1)];
    this.index += 1;
    return piece;
  }
}

function createHarness({ board = new Board(4, 4), pieces } = {}) {
  const input = {
    callback: null,
    stopped: false,
    start(callback) { this.callback = callback; },
    stop() { this.stopped = true; }
  };
  const renderer = {
    frames: [],
    cursorHidden: false,
    cursorShown: false,
    render(snapshot) { this.frames.push(snapshot); },
    hideCursor() { this.cursorHidden = true; },
    showCursor() { this.cursorShown = true; }
  };
  const scheduled = [];
  const cancelled = [];
  const game = new Game({
    board,
    pieces: pieces || new PieceQueue(new Piece('O', [[1, 1], [1, 1]])),
    input,
    renderer,
    schedule(callback, delay) {
      const timer = { callback, delay };
      scheduled.push(timer);
      return timer;
    },
    cancel(timer) { cancelled.push(timer); }
  });
  return { game, input, renderer, scheduled, cancelled };
}

test('game movement stops at the board walls', () => {
  const { game } = createHarness();

  assert.equal(game.move(-1, 0), true);
  assert.equal(game.move(-1, 0), false);
  assert.deepEqual(game.displaySnapshot().rows.slice(0, 2), [
    ['O', 'O', null, null],
    ['O', 'O', null, null]
  ]);
});

test('hard drop locks a piece, clears a line, and awards drop and line points', () => {
  const board = new Board(4, 4);
  const { game } = createHarness({ board });
  board.place(new Piece('J', [[1, 0, 0, 1]], 0, 3));

  game.hardDrop();

  const snapshot = game.displaySnapshot();
  assert.equal(snapshot.lines, 1);
  assert.equal(snapshot.level, 1);
  assert.equal(snapshot.score, 104);
  assert.deepEqual(snapshot.rows[3], [null, 'O', 'O', null]);
});

test('an unplaceable new piece ends the game', () => {
  const board = new Board(1, 4);
  const pieces = new PieceQueue(new Piece('O', [[1, 1], [1, 1]]));
  const { game } = createHarness({ board, pieces });

  assert.equal(game.displaySnapshot().gameOver, true);
  assert.equal(game.move(0, 1), false);
});

test('start schedules ticks and quit cancels the timer and restores the terminal', () => {
  const { game, input, renderer, scheduled, cancelled } = createHarness();

  game.start();
  assert.equal(renderer.cursorHidden, true);
  assert.equal(renderer.frames.length, 1);
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].delay, 700);

  input.callback('quit');
  assert.equal(input.stopped, true);
  assert.equal(renderer.cursorShown, true);
  assert.deepEqual(cancelled, [scheduled[0]]);
});
