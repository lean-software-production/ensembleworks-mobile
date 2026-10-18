import { WIDTH, HEIGHT } from './render.js';

// Local cell coordinates; each piece's bounding box is centered on spawn.
// Rotations in later tasks use these coordinates around the box anchor.
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

export function createInitialGame({ source = createPieceSource() } = {}) {
  return {
    board: Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(null)),
    active: spawnPiece(source.next()),
    score: 0,
    status: 'running',
  };
}
