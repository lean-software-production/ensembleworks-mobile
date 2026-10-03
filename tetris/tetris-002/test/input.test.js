'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const { TerminalInput } = require('../src/input');

class FakeInput extends EventEmitter {
  constructor() {
    super();
    this.isTTY = true;
    this.isRaw = false;
    this.rawModes = [];
    this.paused = false;
  }

  setEncoding(encoding) { this.encoding = encoding; }
  setRawMode(raw) { this.isRaw = raw; this.rawModes.push(raw); }
  resume() { this.paused = false; }
  pause() { this.paused = true; }
}

test('terminal input maps keys and fragmented arrow sequences to actions', () => {
  const stream = new FakeInput();
  const input = new TerminalInput(stream);
  const actions = [];
  input.start((action) => actions.push(action));

  stream.emit('data', 'aW ');
  stream.emit('data', '\u001b[');
  stream.emit('data', 'C');

  assert.deepEqual(actions, ['left', 'rotate', 'drop', 'right']);
  assert.equal(stream.encoding, 'utf8');
  assert.deepEqual(stream.rawModes, [true]);

  input.stop();
  assert.deepEqual(stream.rawModes, [true, false]);
  assert.equal(stream.paused, true);
});

test('terminal input consumes an unknown escape sequence without treating its payload as keys', () => {
  const stream = new FakeInput();
  const input = new TerminalInput(stream);
  const actions = [];
  input.start((action) => actions.push(action));

  stream.emit('data', '\u001b]wasdq\u0007d');

  assert.deepEqual(actions, ['right']);
  input.stop();
});
