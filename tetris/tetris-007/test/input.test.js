const test = require('node:test');
const assert = require('node:assert/strict');
const { KeyDecoder } = require('../src/input');

test('decodes every keypress from a combined input chunk', () => {
  const input = new KeyDecoder();

  assert.deepEqual(input.push('\x1b[D\x1b[Dqq'), ['\x1b[D', '\x1b[D', 'q', 'q']);
});

test('buffers split arrow escape sequences until complete', () => {
  const input = new KeyDecoder();

  assert.deepEqual(input.push('\x1b'), []);
  assert.deepEqual(input.push('['), []);
  assert.deepEqual(input.push('Aq'), ['\x1b[A', 'q']);
});

test('decodes application-mode arrow sequences', () => {
  const input = new KeyDecoder();

  assert.deepEqual(input.push('\x1bOC\x1bOD'), ['\x1b[C', '\x1b[D']);
});
