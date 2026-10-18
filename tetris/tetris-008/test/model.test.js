import test from 'node:test';
import assert from 'node:assert/strict';
import { SHAPES, TYPES, createPieceSource, spawnPiece, createInitialGame, canPlace, moveHorizontal, stepDown, rotateClockwise, lockPiece, advanceDown } from '../src/model.js';
import { renderFrame, WIDTH, HEIGHT } from '../src/render.js';
import { start } from '../src/index.js';

test('all seven distinct tetrominoes spawn centered, in bounds on an empty board', () => {
  assert.equal(TYPES.length, 7);
  for (const type of TYPES) {
    const cells = SHAPES[type];
    assert.equal(cells.length, 4, type);
    assert.equal(new Set(cells.map(cell => cell.join(','))).size, 4, type);
    const piece = spawnPiece(type);
    const xs = piece.cells.map(([x]) => x + piece.x);
    assert.ok(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - (WIDTH - 1) / 2) <= 0.5, type);
    assert.ok(piece.cells.every(([x, y]) => x + piece.x >= 0 && x + piece.x < WIDTH && y + piece.y >= 0 && y + piece.y < HEIGHT), type);
  }
});

test('seeded source replays and exercises every piece; injected source selects spawn', () => {
  const source = createPieceSource(42);
  const sequence = Array.from({ length: 200 }, () => source.next());
  assert.deepEqual(new Set(sequence), new Set(TYPES));
  source.reset();
  assert.deepEqual(Array.from({ length: 200 }, () => source.next()), sequence);
  assert.equal(createPieceSource(42).next(), sequence[0]);
  for (const type of TYPES) {
    const game = createInitialGame({ source: { next: () => type } });
    assert.equal(game.active.type, type);
    assert.equal(game.score, 0);
    assert.equal(game.status, 'running');
    assert.equal(game.board.length, HEIGHT);
    assert.ok(game.board.every(row => row.length === WIDTH && row.every(cell => cell === null)));
    const frame = renderFrame(game);
    assert.equal(frame.split('\n').length, 24);
    assert.equal((frame.match(/<>/g) ?? []).length, 4);
    assert.ok(frame.split('\n').every(line => line.length <= 50));
  }
});

test('horizontal moves use one-cell steps and do not collide with the active piece', () => {
  const game = createInitialGame({ source: { next: () => 'O' } });
  const left = moveHorizontal(game, -1);
  assert.equal(left.active.x, game.active.x - 1);
  assert.equal(moveHorizontal(left, 1).active.x, game.active.x);
  assert.equal(canPlace(game.board, game.active), true);
  assert.equal(game.active.x, 4);
  assert.strictEqual(left.board, game.board);
});

test('walls reject repeated movement without changing state', () => {
  for (const type of TYPES) {
    for (const direction of [-1, 1]) {
      let game = createInitialGame({ source: { next: () => type } });
      for (let i = 0; i < WIDTH * 2; i++) game = moveHorizontal(game, direction);
      const edge = game;
      for (let i = 0; i < WIDTH * 2; i++) assert.strictEqual(moveHorizontal(game, direction), edge);
      assert.ok(edge.active.cells.every(([dx]) => edge.active.x + dx >= 0 && edge.active.x + dx < WIDTH));
    }
  }
});

test('settled cells block movement while preserving board and active state', () => {
  const game = createInitialGame({ source: { next: () => 'O' } });
  game.board[0][6] = 'T';
  const snapshot = structuredClone(game);
  assert.equal(canPlace(game.board, { ...game.active, x: 5 }), false);
  assert.strictEqual(moveHorizontal(game, 1), game);
  assert.deepEqual(game, snapshot);
  assert.equal(moveHorizontal(game, -1).active.x, 3);
  assert.equal(game.board[0][6], 'T');
});

test('downward primitive advances one row without touching settled cells or source', () => {
  let draws = 0;
  const game = createInitialGame({ source: { next: () => { draws++; return 'T'; } } });
  const { game: advanced, blocked } = stepDown(game);
  assert.equal(blocked, false);
  assert.equal(advanced.active.y, game.active.y + 1);
  assert.deepEqual(advanced.active.cells, game.active.cells);
  assert.strictEqual(advanced.board, game.board);
  assert.strictEqual(game.active.y, 0);
  assert.equal(draws, 1);
  assert.equal(advanced.score, game.score);
});

test('floor and settled obstruction stop repeated downward steps without locking', () => {
  for (const type of TYPES) {
    let game = createInitialGame({ source: { next: () => type } });
    const board = game.board;
    let steps = 0;
    while (true) {
      const result = stepDown(game);
      if (result.blocked) {
        assert.strictEqual(result.game, game);
        break;
      }
      assert.equal(result.game.active.y, game.active.y + 1);
      game = result.game;
      steps++;
      assert.ok(steps <= HEIGHT);
    }
    assert.ok(steps > 0);
    assert.strictEqual(stepDown(game).game, game);
    assert.ok(board.every(row => row.every(cell => cell === null)));
    assert.strictEqual(game.board, board);
  }
  const start = createInitialGame({ source: { next: () => 'O' } });
  start.board[4][start.active.x] = 'I';
  const before = structuredClone(start);
  let game = start;
  for (let i = 0; i < 2; i++) {
    const result = stepDown(game);
    assert.equal(result.blocked, false);
    game = result.game;
  }
  assert.equal(game.active.y, 2);
  for (let i = 0; i < 3; i++) {
    const result = stepDown(game);
    assert.equal(result.blocked, true);
    assert.strictEqual(result.game, game);
  }
  assert.deepEqual(start, before);
  assert.strictEqual(game.board, start.board);
  assert.equal(game.board[4][start.active.x], 'I');
  assert.equal(game.board.flat().filter(Boolean).length, 1);
});

test('clockwise rotations preserve four cells and return to original geometry after four turns', () => {
  for (const type of TYPES) {
    const start = createInitialGame({ source: { next: () => type } });
    let game = { ...start, active: { ...start.active, x: 3, y: 5 } };
    const original = game;
    for (let i = 0; i < 4; i++) {
      game = rotateClockwise(game);
      assert.equal(game.active.cells.length, 4, type);
      assert.equal(new Set(game.active.cells.map(cell => cell.join(','))).size, 4, type);
      assert.ok(canPlace(game.board, game.active), type);
      assert.strictEqual(game.board, start.board);
    }
    assert.deepEqual(game.active, original.active, type);
    if (type === 'O') assert.strictEqual(game, original);
  }
});

test('rotation rejects wall, floor and settled obstruction without kicks or mutation', () => {
  const start = createInitialGame({ source: { next: () => 'I' } });
  const vertical = rotateClockwise(start);
  assert.ok(canPlace(vertical.board, vertical.active));
  const cases = [
    { ...vertical, active: { ...vertical.active, x: 7 } }, // horizontal needs four columns; shifting left would fit
    { ...start, active: { ...start.active, y: HEIGHT - 1 } }, // vertical needs four rows
    { ...start, board: start.board.map(row => [...row]) },
  ];
  cases[2].board[1][start.active.x] = 'O'; // target only, not the starting cells
  for (const game of cases) {
    assert.ok(canPlace(game.board, game.active));
    const snapshot = structuredClone(game);
    assert.strictEqual(rotateClockwise(game), game);
    assert.deepEqual(game, snapshot);
  }
  assert.ok(canPlace(cases[0].board, { ...rotateClockwise(vertical).active, x: 6 }));
});

test('lock copies exactly four cells without changing unrelated settled cells', () => {
  const game = createInitialGame({ source: { next: () => 'O' } });
  game.board[10][0] = 'I';
  const locked = lockPiece({ ...game, active: { ...game.active, y: 18 } });
  assert.equal(locked.active, null);
  assert.equal(locked.board.flat().filter(Boolean).length, 5);
  assert.equal(locked.board[10][0], 'I');
  assert.equal(game.board.flat().filter(Boolean).length, 1);
  assert.strictEqual(lockPiece(locked), locked);
  for (const [dx, dy] of game.active.cells) assert.equal(locked.board[18 + dy][game.active.x + dx], 'O');
});

test('downward action steps without drawing, then locks once and spawns without advancing', () => {
  let draws = 0;
  const source = { next: () => { draws++; return draws === 1 ? 'O' : 'T'; } };
  let game = createInitialGame({ source });
  const first = advanceDown(game, source);
  assert.equal(first.locked, false);
  assert.equal(draws, 1);
  assert.equal(first.game.board.flat().filter(Boolean).length, 0);
  game = { ...first.game, active: { ...first.game.active, y: 18 } };
  const result = advanceDown(game, source);
  assert.equal(result.locked, true);
  assert.equal(result.blockedSpawn, false);
  assert.equal(draws, 2);
  assert.equal(result.game.board.flat().filter(Boolean).length, 4);
  assert.equal(result.game.active.type, 'T');
  assert.equal(result.game.active.y, 0);
  assert.deepEqual(result.game.active, spawnPiece('T'));
  for (const [dx, dy] of game.active.cells) {
    assert.equal(result.game.board[game.active.y + dy][game.active.x + dx], 'O');
  }
  assert.equal(game.board.flat().filter(Boolean).length, 0);
  const nextStep = advanceDown(result.game, source);
  assert.equal(nextStep.locked, false);
  assert.equal(nextStep.game.active.y, 1);
  assert.equal(draws, 2);
});

test('blocked next spawn preserves settled cells and cannot draw again', () => {
  let draws = 0;
  const source = { next: () => { draws++; return 'O'; } };
  const start = createInitialGame({ source });
  const game = { ...start, active: { ...start.active, y: 1 } };
  game.board[3][game.active.x] = 'I';
  const result = advanceDown(game, source);
  assert.equal(result.locked, true);
  assert.equal(result.blockedSpawn, true);
  assert.equal(result.game.status, 'over');
  assert.equal(result.game.active, null);
  assert.equal(result.game.board[3][game.active.x], 'I');
  assert.equal(result.game.board.flat().filter(Boolean).length, 5);
  assert.strictEqual(advanceDown(result.game, source).game, result.game);
  assert.equal(draws, 2);
});

test('launch seam accepts injected piece source without changing board', () => {
  let frame = '';
  const game = start({ source: { next: () => 'I' }, output: { write: text => { frame += text; } } });
  assert.equal(game.active.type, 'I');
  assert.equal((frame.match(/<>/g) ?? []).length, 4);
  assert.equal(frame.split('\n').length, 24);
});
