'use strict';

const LINE_SCORES = [0, 100, 300, 500, 800];

class Game {
  constructor({ board, pieces, input, renderer, schedule = setTimeout, cancel = clearTimeout, onQuit = null }) {
    this.board = board;
    this.pieces = pieces;
    this.input = input;
    this.renderer = renderer;
    this.schedule = schedule;
    this.cancel = cancel;
    this.onQuit = onQuit;
    this.timer = null;
    this.running = false;
    this.reset();
  }

  reset() {
    this.board.reset();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.gameOver = false;
    this.activePiece = null;
    this.spawnPiece();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.renderer.hideCursor();
    this.input.start((action) => this.handleAction(action));
    this.render();
    this.queueTick();
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.cancelTick();
    this.input.stop();
    this.renderer.showCursor();
  }

  cancelTick() {
    if (this.timer === null) return;
    this.cancel(this.timer);
    this.timer = null;
  }

  queueTick() {
    if (!this.running || this.gameOver || this.timer !== null) return;
    const delay = Math.max(100, 700 - ((this.level - 1) * 60));
    this.timer = this.schedule(() => {
      this.timer = null;
      if (!this.running || this.gameOver) return;
      this.tick();
      this.queueTick();
    }, delay);
  }

  tick() {
    if (this.gameOver) return;
    if (!this.move(0, 1)) this.lockPiece();
    this.render();
  }

  endGame() {
    this.gameOver = true;
    this.cancelTick();
  }

  spawnPiece() {
    const piece = this.pieces.next().centeredIn(this.board.width);
    this.activePiece = piece;
    if (!this.board.canPlace(piece)) this.endGame();
  }

  move(dx, dy) {
    if (this.gameOver) return false;
    const candidate = this.activePiece.moved(dx, dy);
    if (!this.board.canPlace(candidate)) return false;
    this.activePiece = candidate;
    return true;
  }

  rotate() {
    if (this.gameOver) return false;
    const rotated = this.activePiece.rotated();
    for (const offset of [0, -1, 1, -2, 2]) {
      const candidate = rotated.moved(offset, 0);
      if (this.board.canPlace(candidate)) {
        this.activePiece = candidate;
        return true;
      }
    }
    return false;
  }

  hardDrop() {
    if (this.gameOver) return;
    let distance = 0;
    while (this.move(0, 1)) distance += 1;
    this.score += distance * 2;
    this.lockPiece();
  }

  lockPiece() {
    if (this.board.place(this.activePiece)) {
      this.endGame();
      return;
    }
    const cleared = this.board.clearLines();
    this.lines += cleared;
    this.level = Math.floor(this.lines / 10) + 1;
    this.score += LINE_SCORES[cleared] * this.level;
    this.spawnPiece();
  }

  displaySnapshot() {
    return {
      rows: this.board.snapshot(this.activePiece),
      width: this.board.width,
      score: this.score,
      lines: this.lines,
      level: this.level,
      gameOver: this.gameOver
    };
  }

  render() {
    this.renderer.render(this.displaySnapshot());
  }

  handleAction(action) {
    if (action === 'quit') {
      this.stop();
      if (this.onQuit) this.onQuit();
      return;
    }
    if (action === 'restart') {
      if (this.gameOver) {
        this.cancelTick();
        this.reset();
        this.render();
        this.queueTick();
      }
      return;
    }
    if (this.gameOver) return;

    if (action === 'left') this.move(-1, 0);
    if (action === 'right') this.move(1, 0);
    if (action === 'down' && this.move(0, 1)) this.score += 1;
    if (action === 'rotate') this.rotate();
    if (action === 'drop') this.hardDrop();
    this.render();
  }
}

module.exports = { Game };
