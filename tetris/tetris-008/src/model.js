import { WIDTH, HEIGHT } from './render.js';

// Local cell coordinates; each piece's bounding box is centered on spawn.
// Clockwise rotation turns the bounding box around its fixed top-left anchor.
export const SHAPES = Object.freeze({
  I: [[0, 0], [1, 0], [2, 0], [3, 0]],
  O: [[0, 0], [1, 0], [0, 1], [1, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
});
export const TYPES = Object.freeze(Object.keys(SHAPES));

// A supplied seed replays the same sequence, including after reset().
// No seed uses a random initial state for ordinary play.
export function createPieceSource(seed) {
  const initial = seed === undefined ? Math.floor(Math.random() * 0x100000000) >>> 0 : seed >>> 0;
  let state = initial;
  return {
    next() {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return TYPES[Math.floor((state / 0x100000000) * TYPES.length)];
    },
    reset() { state = initial; },
  };
}

export function spawnPiece(type) {
  const cells = SHAPES[type];
  if (!cells) throw new RangeError(`Unknown tetromino: ${type}`);
  const width = Math.max(...cells.map(([x]) => x)) + 1;
  return { type, x: Math.floor((WIDTH - width) / 2), y: 0, cells: cells.map(cell => [...cell]) };
}

// Placement checks only settled cells: the moving piece never blocks itself.
export function canPlace(board, piece) {
  return piece.cells.every(([dx, dy]) => {
    const x = piece.x + dx;
    const y = piece.y + dy;
    return x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT && board[y][x] === null;
  });
}

// Rejected moves return the original state, including its board and active piece.
export function moveHorizontal(game, direction) {
  if (game.status !== 'running' || !game.active || ![-1, 1].includes(direction)) return game;
  const active = { ...game.active, x: game.active.x + direction };
  return canPlace(game.board, active) ? { ...game, active } : game;
}

// One-row primitive: blockage is reported without locking, clearing or drawing.
// A rejected step retains the exact original game object.
export function stepDown(game) {
  if (game.status !== 'running' || !game.active) return { game, blocked: true };
  const active = { ...game.active, y: game.active.y + 1 };
  if (!canPlace(game.board, active)) return { game, blocked: true };
  return { game: { ...game, active }, blocked: false };
}

// (x, y) -> (height - 1 - y, x) in the current local bounding box.
// The anchor never shifts: invalid rotations have no wall kicks or floor kicks.
// The square is invariant. Rejection returns the identical game object.
export function rotateClockwise(game) {
  if (game.status !== 'running' || !game.active || game.active.type === 'O') return game;
  const height = Math.max(...game.active.cells.map(([, y]) => y)) + 1;
  const cells = game.active.cells.map(([x, y]) => [height - 1 - y, x]);
  const active = { ...game.active, cells };
  return canPlace(game.board, active) ? { ...game, active } : game;
}

// Lock is a pure copy: the four active cells become settled without changing
// the original board or unrelated cells.
export function lockPiece(game) {
  if (game.status !== 'running' || !game.active) return game;
  const board = game.board.map(row => [...row]);
  for (const [dx, dy] of game.active.cells) {
    board[game.active.y + dy][game.active.x + dx] = game.active.type;
  }
  return { ...game, board, active: null };
}

// One downward game action. A successful step does not draw; a blocked step
// locks exactly once and tests one new piece against the settled board.
// Clearing and scoring will be inserted between locking and spawning later.
export function advanceDown(game, source) {
  if (game.status !== 'running' || !game.active) return { game, locked: false, blockedSpawn: false };
  const step = stepDown(game);
  if (!step.blocked) return { game: step.game, locked: false, blockedSpawn: false };
  const locked = lockPiece(game);
  const next = spawnPiece(source.next());
  const blockedSpawn = !canPlace(locked.board, next);
  return {
    game: { ...locked, active: blockedSpawn ? null : next, status: blockedSpawn ? 'over' : 'running' },
    locked: true,
    blockedSpawn,
  };
}

export function createInitialGame({ source = createPieceSource() } = {}) {
  return {
    board: Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(null)),
    active: spawnPiece(source.next()),
    score: 0,
    status: 'running',
  };
}
