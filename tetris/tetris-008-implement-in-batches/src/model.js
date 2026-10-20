export const WIDTH = 10;
export const HEIGHT = 20;
// Clockwise rotation in fixed local boxes: I=4, O=2, others=3.
// No kicks; O is invariant. All spawn cells are visible.
export const SHAPES = Object.freeze(Object.fromEntries(Object.entries({
  I: [[0,1],[1,1],[2,1],[3,1]],
  O: [[0,0],[1,0],[0,1],[1,1]],
  T: [[1,0],[0,1],[1,1],[2,1]],
  S: [[1,0],[2,0],[0,1],[1,1]],
  Z: [[0,0],[1,0],[1,1],[2,1]],
  J: [[0,0],[0,1],[1,1],[2,1]],
  L: [[2,0],[0,1],[1,1],[2,1]]
}).map(([type, cells]) => [type, Object.freeze(cells.map(cell => Object.freeze(cell)))])));
export const TYPES = Object.freeze(Object.keys(SHAPES));
export function pieceSource(random = Math.random) {
  return () => {
    const value = random();
    if (!(value >= 0 && value < 1)) throw new RangeError('Random value must be in [0,1)');
    return TYPES[Math.floor(value * TYPES.length)];
  };
}
export function spawn(type) {
  if (!SHAPES[type]) throw new RangeError('Unknown piece');
  const size = type === 'I' ? 4 : type === 'O' ? 2 : 3;
  return { type, x: Math.floor((WIDTH - size) / 2), y: 0, cells: SHAPES[type].map(c => [...c]) };
}
export function createState(next = pieceSource()) {
  return { board: Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(null)), active: spawn(next()), score: 0, status: 'running' };
}
export function cellsOf(piece) {
  return piece.cells.map(([x,y]) => [x + piece.x, y + piece.y]);
}
export function canPlace(board, piece) {
  return cellsOf(piece).every(([x,y]) => x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT && board[y][x] === null);
}
function place(state, candidate) {
  if (state.status !== 'running' || !canPlace(state.board, candidate)) return false;
  state.active = candidate;
  return true;
}
export function moveHorizontal(state, direction) {
  if (direction !== -1 && direction !== 1) throw new RangeError('Direction must be -1 or 1');
  return place(state, { ...state.active, x: state.active.x + direction });
}
export function rotate(state) {
  const p = state.active;
  const size = p.type === 'I' ? 4 : p.type === 'O' ? 2 : 3;
  const cells = p.type === 'O' ? p.cells : p.cells.map(([x,y]) => [size - 1 - y, x]);
  return place(state, { ...p, cells });
}
// Does not lock, score, or consume a piece, even when blocked.
export function stepDown(state) {
  const moved = place(state, { ...state.active, y: state.active.y + 1 });
  return { moved, blocked: !moved };
}
