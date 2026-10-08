'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TerminalController } = require('../src/index');

test('quit stops terminal resources before notifying its owner', () => {
  const calls = [];
  const controller = new TerminalController({
    onQuit: () => calls.push('onQuit'),
  });
  controller.stop = () => calls.push('stop');

  controller.quit();

  assert.deepEqual(calls, ['stop', 'onQuit']);
});
