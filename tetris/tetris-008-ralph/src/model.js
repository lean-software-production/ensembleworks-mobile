export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

// Local spawn coordinates; x grows right, y grows down. Rotation works
// on copies without changing these shared definitions.
export const SHAPES = Object.freeze(Object.fromEntries(Object.entries({
  I: [[0, 0], [1, 0], [2, 0], [3, 0]],
  O: [[0, 0], [1, 0], [0, 1], [1, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
}).map(([type, cells]) => [type, Object.freeze(cells.map(cell => Object.freeze(cell)))])));
export const PIECE_TYPES = Object.freeze(Object.keys(SHAPES));

// Mulberry32: explicit integer seed gives repeatable selection across runs.
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    let t = state += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createPieceSource(random = Math.random) {
  return () => {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError('Random value must be in [0, 1)');
    }
    return PIECE_TYPES[Math.floor(value * PIECE_TYPES.length)];
  };
}

export function spawnPiece(type) {
  if (!Object.hasOwn(SHAPES, type)) throw new RangeError('Unknown piece type');
  const cells = SHAPES[type].map(cell => [...cell]);
  const width = Math.max(...cells.map(([x]) => x)) + 1;
  return { type, cells, x: Math.floor((BOARD_WIDTH - width) / 2), y: 0 };
}

export function activeCells(piece) {
  return piece.cells.map(([x, y]) => [x + piece.x, y + piece.y]);
}

// Shared placement rule: only settled cells obstruct the candidate piece.
// Active geometry stays separate and may overlap its own previous position.
export function canPlace(board, piece) {
  return activeCells(piece).every(([x, y]) =>
    Number.isInteger(x) && Number.isInteger(y) &&
    x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT &&
    board[y][x] === null);
}

// Mutate only on success; rejected actions preserve the entire game state.
export function moveHorizontal(game, direction) {
  if (game.status !== 'running' || !game.active ||
      (direction !== -1 && direction !== 1)) return false;
  const candidate = { ...game.active, x: game.active.x + direction };
  if (!canPlace(game.board, candidate)) return false;
  game.active = candidate;
  return true;
}

export const moveLeft = game => moveHorizontal(game, -1);
export const moveRight = game => moveHorizontal(game, 1);

// Clockwise in a fixed local square: (x, y) -> (size - 1 - y, x).
// I uses 4×4, other non-square pieces use 3×3. O is unchanged.
// The origin never moves; no wall kicks or geometry normalization.
export function rotateClockwise(game) {
  if (game.status !== 'running' || !game.active) return false;
  if (game.active.type === 'O') return true;
  const size = game.active.type === 'I' ? 4 : 3;
  const candidate = {
    ...game.active,
    cells: game.active.cells.map(([x, y]) => [size - 1 - y, x]),
  };
  if (!canPlace(game.board, candidate)) return false;
  game.active = candidate;
  return true;
}

// Non-locking descent primitive: true means moved one row; false means
// blocked or unavailable. Never merges cells, scores, or consumes a piece.
export function moveDown(game) {
  if (game.status !== 'running' || !game.active) return false;
  const candidate = { ...game.active, y: game.active.y + 1 };
  if (!canPlace(game.board, candidate)) return false;
  game.active = candidate;
  return true;
}

// Keep injected sources outside the serializable, renderer-facing game state.
const pieceSources = new WeakMap();

// Settle a valid active piece once, without consuming the next piece.
export function lockPiece(game) {
  if (game.status !== 'running' || !game.active ||
      !canPlace(game.board, game.active)) return false;
  for (const [x, y] of activeCells(game.active)) {
    game.board[y][x] = game.active.type;
  }
  game.active = null;
  return true;
}

// Stable compaction, preserving the board identity and surviving row order.
// Newly inserted rows are independent; null is the only empty-cell value.
export function clearLines(board) {
  const remaining = board.filter(row => row.some(cell => cell === null));
  const cleared = BOARD_HEIGHT - remaining.length;
  if (cleared > 0) {
    board.splice(0, board.length,
      ...Array.from({ length: cleared }, () => Array(BOARD_WIDTH).fill(null)),
      ...remaining);
  }
  return cleared;
}

// Fixed line-clear points, independent of level or descent distance.
export const LINE_POINTS = Object.freeze([0, 100, 300, 500, 800]);

// One gameplay descent: move OR settle, compact, score and spawn.
// A blocked spawn is explicit and leaves no overlapping active geometry.
export function descend(game) {
  if (game.status !== 'running' || !game.active ||
      !canPlace(game.board, game.active)) return { kind: 'ignored' };
  if (moveDown(game)) return { kind: 'moved' };
  if (!lockPiece(game)) return { kind: 'ignored' };
  const cleared = clearLines(game.board);
  game.score += LINE_POINTS[cleared];
  const next = spawnPiece(pieceSources.get(game)());
  const spawnBlocked = !canPlace(game.board, next);
  if (!spawnBlocked) game.active = next;
  return { kind: 'locked', cleared, spawnBlocked };
}

export function createGame(nextPiece = createPieceSource()) {
  const game = {
    board: Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null)),
    active: spawnPiece(nextPiece()),
    score: 0,
    status: 'running',
  };
  pieceSources.set(game, nextPiece);
  return game;
}
