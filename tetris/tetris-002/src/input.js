'use strict';

const KEY_ACTIONS = Object.freeze({
  a: 'left',
  d: 'right',
  s: 'down',
  w: 'rotate',
  ' ': 'drop',
  q: 'quit',
  r: 'restart',
  '\u0003': 'quit'
});

const ESCAPE_ACTIONS = Object.freeze({
  '\u001b[D': 'left',
  '\u001b[C': 'right',
  '\u001b[B': 'down',
  '\u001b[A': 'rotate',
  '\u001bOD': 'left',
  '\u001bOC': 'right',
  '\u001bOB': 'down',
  '\u001bOA': 'rotate'
});

const STRING_TERMINATED_ESCAPES = new Set([']', 'P', 'X', '^', '_']);

function escapeSequenceLength(buffer) {
  if (buffer.length === 1) return null;

  const introducer = buffer[1];
  if (introducer === '[' || introducer === 'O') {
    for (let index = 2; index < buffer.length; index += 1) {
      const code = buffer.charCodeAt(index);
      if (code >= 0x40 && code <= 0x7e) return index + 1;
    }
    return null;
  }

  if (STRING_TERMINATED_ESCAPES.has(introducer)) {
    for (let index = 2; index < buffer.length; index += 1) {
      if (introducer === ']' && buffer.charCodeAt(index) === 0x07) return index + 1;
      if (buffer[index] === '\u001b' && buffer[index + 1] === '\\') return index + 2;
    }
    return null;
  }

  let index = 1;
  while (index < buffer.length) {
    const code = buffer.charCodeAt(index);
    if (code < 0x20 || code > 0x2f) return index + 1;
    index += 1;
  }
  return null;
}

class TerminalInput {
  constructor(input = process.stdin) {
    this.input = input;
    this.onAction = null;
    this.buffer = '';
    this.wasRaw = false;
    this.handleData = this.handleData.bind(this);
  }

  start(onAction) {
    if (typeof onAction !== 'function') throw new TypeError('onAction must be a function');
    if (this.onAction) return;

    this.onAction = onAction;
    this.buffer = '';
    this.input.setEncoding('utf8');
    this.input.on('data', this.handleData);
    if (this.input.isTTY) {
      this.wasRaw = Boolean(this.input.isRaw);
      if (typeof this.input.setRawMode === 'function') this.input.setRawMode(true);
      if (typeof this.input.resume === 'function') this.input.resume();
    }
  }

  handleData(data) {
    if (!this.onAction) return;
    this.buffer += String(data);

    while (this.buffer.length > 0 && this.onAction) {
      if (this.buffer[0] === '\u001b') {
        const length = escapeSequenceLength(this.buffer);
        if (length === null) return;

        const sequence = this.buffer.slice(0, length);
        this.buffer = this.buffer.slice(length);
        const action = ESCAPE_ACTIONS[sequence];
        if (action) this.onAction(action);
        continue;
      }

      const key = this.buffer[0];
      this.buffer = this.buffer.slice(1);
      const action = KEY_ACTIONS[key.toLowerCase()];
      if (action) this.onAction(action);
    }
  }

  stop() {
    if (!this.onAction) return;
    this.input.removeListener('data', this.handleData);
    if (this.input.isTTY && !this.wasRaw && typeof this.input.setRawMode === 'function') {
      this.input.setRawMode(false);
    }
    if (typeof this.input.pause === 'function') this.input.pause();
    this.onAction = null;
    this.buffer = '';
  }
}

module.exports = { TerminalInput };
