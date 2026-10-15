'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createGame, createPieceSource } = require('../src/game');
const { createGravityController } = require('../src/gravity');
const { createInputAdapter } = require('../src/input');

function createFakeClock() {
  let nextId = 1;
  const timers = new Map();
  return {
    setInterval(callback) { timers.set(nextId, callback); return nextId++; },
    clearInterval(id) { timers.delete(id); },
    get timerCount() { return timers.size; },
  };
}

function setup() {
  const game = createGame({ pieceSource: createPieceSource({ sequence: ['T', 'O'] }) });
  const gravity = createGravityController(game, { scheduler: createFakeClock() });
  let redraws = 0;
  let quits = 0;
  const input = createInputAdapter(game, gravity, {
    onChange: () => { redraws += 1; },
    onQuit: () => { quits += 1; },
  });
  return { game, gravity, input, get redraws() { return redraws; }, get quits() { return quits; } };
}

test('input adapter decodes multiple arrow keys and split escape sequences', () => {
  const session = setup();
  const startX = session.game.activePiece.x;

  assert.deepEqual(session.input.write('\u001b'), []);
  assert.deepEqual(session.input.write('[D\u001b[C\u001b[A\u001b[B'), ['left', 'right', 'rotate', 'down']);
  assert.equal(session.game.activePiece.x, startX);
  assert.equal(session.game.activePiece.y, 1);
  assert.equal(session.game.activePiece.cells.length, 4);
  assert.equal(session.redraws, 4);
});

test('unknown input causes no state change', () => {
  const session = setup();
  const before = JSON.stringify({ board: session.game.board, piece: session.game.activePiece, score: session.game.score });

  assert.deepEqual(session.input.write('x\u001b[X\r'), []);
  assert.equal(JSON.stringify({ board: session.game.board, piece: session.game.activePiece, score: session.game.score }), before);
  assert.equal(session.redraws, 0);
});

test('scripted controls move, descend, pause, resume, restart, and quit', () => {
  const session = setup();
  const startX = session.game.activePiece.x;

  session.input.write('\u001b[D\u001b[A\u001b[Bp');
  assert.equal(session.game.activePiece.x, startX - 1);
  assert.equal(session.game.activePiece.y, 1);
  assert.equal(session.game.paused, true);
  assert.equal(session.gravity.running, false);

  session.input.write('p');
  assert.equal(session.game.paused, false);
  assert.equal(session.gravity.running, true);

  // Restart is intentionally available only after game over.
  session.game.gameOver = true;
  session.game.activePiece = null;
  session.input.write('r');
  assert.equal(session.game.gameOver, false);
  assert.equal(session.game.score, 0);
  assert.ok(session.game.activePiece);
  assert.equal(session.gravity.running, true);

  session.input.write('q');
  assert.equal(session.quits, 1);
});
