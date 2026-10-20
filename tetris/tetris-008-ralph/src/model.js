export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

// Local spawn coordinates; x grows right, y grows down. Future rotations
// can operate on a copy without changing these shared definitions.
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

export function createGame(nextPiece = createPieceSource()) {
  return {
    board: Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null)),
    active: spawnPiece(nextPiece()),
    score: 0,
    status: 'running',
  };
}
