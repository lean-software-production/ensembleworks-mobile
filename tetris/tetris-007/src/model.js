export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

// Points per simultaneous clear; no movement/drop bonuses or level multiplier.
export const LINE_POINTS = Object.freeze([0, 100, 300, 500, 800]);

// Coordinates are local to fixed square rotation frames; I starts on row 1.
const definitions = {
  I: { size: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  O: { size: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { size: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  S: { size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
};
export const TETROMINOES = Object.freeze(Object.fromEntries(
  Object.entries(definitions).map(([type, shape]) => [type, Object.freeze({
    size: shape.size,
    cells: Object.freeze(shape.cells.map(cell => Object.freeze(cell))),
  })]),
));
export const PIECE_TYPES = Object.freeze(Object.keys(TETROMINOES));

export function createEmptyState() {
  return {
    board: Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null)),
    active: null,
    score: 0,
    status: 'running',
  };
}

export function createRandomTypeSource(random = Math.random) {
  return () => {
    const value = random();
    if (!(value >= 0 && value < 1)) throw new RangeError('Random value must be in [0, 1)');
    return PIECE_TYPES[Math.floor(value * PIECE_TYPES.length)];
  };
}

export function createSpawnPiece(type) {
  if (!Object.hasOwn(TETROMINOES, type)) throw new RangeError(`Unknown tetromino: ${type}`);
  const cells = TETROMINOES[type].cells;
  const minX = Math.min(...cells.map(([x]) => x));
  const maxX = Math.max(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return {
    type,
    x: Math.floor((BOARD_WIDTH - (maxX - minX + 1)) / 2) - minX,
    y: -minY,
    cells: cells.map(cell => [...cell]),
  };
}

export function activeCells(piece) {
  return piece ? piece.cells.map(([x, y]) => [piece.x + x, piece.y + y]) : [];
}

// Only settled cells participate: the active piece never collides with itself.
export function canPlace(board, piece) {
  return piece !== null && activeCells(piece).every(([x, y]) =>
    x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT && board[y][x] === null);
}

function moveHorizontal(state, dx) {
  if (state.status !== 'running' || !state.active) return { moved: false };
  const candidate = { ...state.active, x: state.active.x + dx };
  if (!canPlace(state.board, candidate)) return { moved: false };
  state.active = candidate;
  return { moved: true };
}

export const moveLeft = state => moveHorizontal(state, -1);
export const moveRight = state => moveHorizontal(state, 1);

// One downward attempt only: rejection never locks, spawns, or changes state.
// `blocked` also covers unavailable actions (no active piece or frozen status).
export function stepDown(state) {
  if (state.status !== 'running' || !state.active) return { moved: false, blocked: true };
  const candidate = { ...state.active, y: state.active.y + 1 };
  if (!canPlace(state.board, candidate)) return { moved: false, blocked: true };
  state.active = candidate;
  return { moved: true, blocked: false };
}

// Compact simultaneously: survivor order is stable, with fresh empty rows above.
export function clearFullRows(board) {
  const survivors = board.filter(row => row.some(cell => cell === null));
  const clearedRows = BOARD_HEIGHT - survivors.length;
  return {
    board: [
      ...Array.from({ length: clearedRows }, () => Array(BOARD_WIDTH).fill(null)),
      ...survivors.map(row => [...row]),
    ],
    clearedRows,
  };
}

// Lock, clear, and spawn are one transaction. Until game-over handling is introduced,
// a blocked spawn is explicit in the result and leaves active null.
export function lockPiece(state, typeSource = createRandomTypeSource()) {
  const unchanged = { locked: false, clearedRows: 0, spawned: false, spawnBlocked: false };
  if (state.status !== 'running' || !state.active ||
      !canPlace(state.board, state.active)) return unchanged;
  const piece = state.active;
  if (canPlace(state.board, { ...piece, y: piece.y + 1 })) return unchanged;

  // Obtain the candidate before mutation so an invalid source cannot half-lock.
  const next = createSpawnPiece(typeSource());
  for (const [x, y] of activeCells(piece)) state.board[y][x] = piece.type;
  const { board, clearedRows } = clearFullRows(state.board);
  state.board = board;
  state.score += LINE_POINTS[clearedRows];
  const spawned = canPlace(state.board, next);
  state.active = spawned ? next : null;
  return { locked: true, clearedRows, spawned, spawnBlocked: !spawned };
}

// Exactly one downward attempt: never step the piece created by a lock.
export function descend(state, typeSource = createRandomTypeSource()) {
  const { moved } = stepDown(state);
  if (moved) return { moved: true, locked: false, clearedRows: 0, spawned: false, spawnBlocked: false };
  return { moved: false, ...lockPiece(state, typeSource) };
}

// Clockwise in screen coordinates, about the fixed frame center; no kicks.
// O is an identity operation, including its cell ordering and piece identity.
export function rotateClockwise(state) {
  if (state.status !== 'running' || !state.active || state.active.type === 'O') {
    return { rotated: false };
  }
  const piece = state.active;
  const size = TETROMINOES[piece.type].size;
  const candidate = {
    ...piece,
    cells: piece.cells.map(([x, y]) => [size - 1 - y, x]),
  };
  if (!canPlace(state.board, candidate)) return { rotated: false };
  state.active = candidate;
  return { rotated: true };
}

export function createInitialState(typeSource = createRandomTypeSource()) {
  const state = createEmptyState();
  const piece = createSpawnPiece(typeSource());
  if (canPlace(state.board, piece)) state.active = piece;
  return state;
}
