import test from 'node:test';
import assert from 'node:assert/strict';
import { SHAPES, TYPES, LINE_POINTS, createPieceSource, spawnPiece, createInitialGame, canPlace, moveHorizontal, stepDown, rotateClockwise, lockPiece, clearCompletedRows, advanceDown, restartGame } from '../src/model.js';
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
  assert.equal(first.cleared, 0);
  assert.equal(draws, 1);
  assert.equal(first.game.board.flat().filter(Boolean).length, 0);
  game = { ...first.game, active: { ...first.game.active, y: 18 } };
  const result = advanceDown(game, source);
  assert.equal(result.locked, true);
  assert.equal(result.cleared, 0);
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

test('compaction clears zero through four rows, preserving survivor order and input', () => {
  for (let count = 0; count <= 4; count++) {
    const board = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(null));
    board[2][0] = 'I';
    board[8][1] = 'T';
    const fullRows = [3, 7, 12, 18].slice(0, count);
    for (const y of fullRows) board[y].fill('O');
    const snapshot = structuredClone(board);
    const expectedSurvivors = board.filter((_, y) => !fullRows.includes(y));
    const result = clearCompletedRows(board);
    assert.equal(result.cleared, count);
    assert.equal(result.board.length, HEIGHT);
    assert.ok(result.board.every(row => row.length === WIDTH));
    assert.deepEqual(result.board.slice(0, count), Array.from({ length: count }, () => Array(WIDTH).fill(null)));
    assert.deepEqual(result.board.slice(count), expectedSurvivors);
    assert.deepEqual(board, snapshot);
    assert.notStrictEqual(result.board[HEIGHT - 1], board[HEIGHT - 1]);
  }
});

test('blocked downward action locks, completes row, clears before next spawn', () => {
  let draws = 0;
  const source = { next: () => { draws++; return draws === 1 ? 'O' : 'I'; } };
  const start = createInitialGame({ source });
  const board = start.board.map(row => [...row]);
  board[19].fill('T');
  board[19][4] = board[19][5] = null;
  board[18][0] = 'J';
  const game = { ...start, board, active: { ...start.active, y: 18 } };
  const result = advanceDown(game, source);
  assert.equal(result.locked, true);
  assert.equal(result.cleared, 1);
  assert.equal(draws, 2);
  assert.equal(result.blockedSpawn, false);
  assert.deepEqual(result.game.active, spawnPiece('I'));
  assert.equal(result.game.board[19][0], 'J');
  assert.equal(result.game.board[19][4], 'O');
  assert.equal(result.game.board[19][5], 'O');
  assert.ok(result.game.board[18].every(cell => cell === null));
  assert.equal(game.board[19][0], 'T');
  assert.equal(result.game.board.length, HEIGHT);
});

test('scoring awards each clear count once, accumulates and remains visible within 24 rows', () => {
  assert.deepEqual(LINE_POINTS, [0, 100, 300, 500, 800]);
  const source = { next: () => 'I' };
  let accumulated = 0;
  for (let count = 0; count <= 4; count++) {
    const initial = createInitialGame({ source });
    const board = initial.board.map(row => [...row]);
    for (let y = HEIGHT - count; y < HEIGHT; y++) {
      board[y].fill('T');
      board[y][4] = null;
    }
    // A vertical I locks at the floor, filling exactly the chosen rows.
    const active = { ...initial.active, x: 4, y: 16, cells: [[0, 0], [0, 1], [0, 2], [0, 3]] };
    const game = { ...initial, board, active, score: accumulated };
    const snapshot = structuredClone(game);
    assert.equal(moveHorizontal(game, -1).score, accumulated);
    if (count > 0) assert.strictEqual(moveHorizontal(game, -1), game); // settled-row collision
    assert.equal(rotateClockwise(game).score, accumulated);
    assert.equal(stepDown(game).game.score, accumulated);
    const result = advanceDown(game, source);
    assert.equal(result.cleared, count);
    accumulated += LINE_POINTS[count];
    assert.equal(result.game.score, accumulated);
    assert.equal(game.score, snapshot.score);
    assert.deepEqual(game, snapshot);
    const frame = renderFrame(result.game).split('\n');
    assert.equal(frame.length, 24);
    assert.equal(frame[22], `Score: ${accumulated}`);
    assert.ok(frame.every(line => line.length <= 50));
    assert.equal(advanceDown(result.game, source).game.score, accumulated);
  }
  assert.equal(accumulated, 1700);
  const large = renderFrame({ score: 999999999999999 });
  assert.equal(large.split('\n').length, 24);
  assert.ok(large.split('\n').every(line => line.length <= 50));
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

test('game over is inert, renders bounded controls, and restart resets seeded play', () => {
  const source = createPieceSource(42);
  const first = createInitialGame({ source });
  const board = first.board.map(row => [...row]);
  const active = { ...first.active, y: 1 };
  // Obstruct the step while preserving the current active cells.
  const [dx, dy] = active.cells.find(([, y]) => y === Math.max(...active.cells.map(cell => cell[1])));
  board[active.y + dy + 1][active.x + dx] = 'J';
  // Occupy the future spawn region without touching the current piece.
  const nextType = source.next();
  source.reset();
  source.next();
  const next = spawnPiece(nextType);
  const spawnCell = next.cells.find(([x, y]) => !active.cells.some(([ax, ay]) => active.x + ax === next.x + x && active.y + ay === y));
  assert.ok(spawnCell);
  board[next.y + spawnCell[1]][next.x + spawnCell[0]] = 'T';
  const game = { ...first, board, active, score: 300 };
  const result = advanceDown(game, source);
  assert.equal(result.blockedSpawn, true);
  const over = result.game;
  assert.equal(over.status, 'over');
  assert.equal(over.active, null);
  assert.equal(over.score, 300);
  assert.equal(over.board[next.y + spawnCell[1]][next.x + spawnCell[0]], 'T');
  assert.strictEqual(moveHorizontal(over, 1), over);
  assert.strictEqual(rotateClockwise(over), over);
  assert.strictEqual(stepDown(over).game, over);
  assert.strictEqual(advanceDown(over, source).game, over);
  assert.strictEqual(restartGame(game, source), game);
  const frame = renderFrame(over).split('\n');
  assert.equal(frame.length, 24);
  assert.ok(frame.every(line => line.length <= 50));
  assert.match(frame[23], /Game over.*R: restart.*Q: quit/);
  const restarted = restartGame(over, source);
  assert.deepEqual(restarted, first);
  assert.equal(restarted.score, 0);
  assert.equal(renderFrame(restarted).split('\n').length, 24);
});

test('clear opens occupied spawn before game-over verdict', () => {
  let draws = 0;
  const source = { next: () => ++draws === 1 ? 'I' : 'O' };
  const start = createInitialGame({ source });
  const board = start.board.map(row => [...row]);
  board[0].fill('T');
  for (let x = 0; x <= 3; x++) board[0][x] = null;
  board[1][0] = 'J'; // blocks descent; locking I completes row 0
  const game = { ...start, board, active: { ...start.active, x: 0 } };
  assert.equal(canPlace(board, spawnPiece('O')), false);
  const result = advanceDown(game, source);
  assert.equal(result.cleared, 1);
  assert.equal(result.blockedSpawn, false);
  assert.equal(result.game.status, 'running');
  assert.ok(canPlace(result.game.board, result.game.active));
  assert.equal(result.game.score, 100);
});

test('launch seam accepts injected piece source without changing board', () => {
  let frame = '';
  const game = start({ source: { next: () => 'I' }, output: { write: text => { frame += text; } } });
  assert.equal(game.active.type, 'I');
  assert.equal((frame.match(/<>/g) ?? []).length, 4);
  assert.equal(frame.split('\n').length, 24);
});
