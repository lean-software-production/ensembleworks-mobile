'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startGame } = require('../src/index');

function createInput() {
  const calls = [];
  const input = {
    isTTY: true,
    setRawMode: (enabled) => calls.push(['setRawMode', enabled]),
    setEncoding: (encoding) => calls.push(['setEncoding', encoding]),
    resume: () => calls.push(['resume']),
    pause: () => calls.push(['pause']),
    on: (event, listener) => calls.push(['on', event, listener]),
    removeListener: (event, listener) => calls.push(['removeListener', event, listener]),
  };
  return { calls, input };
}

function replaceProcessStreams(input, output) {
  const stdin = Object.getOwnPropertyDescriptor(process, 'stdin');
  const stdout = Object.getOwnPropertyDescriptor(process, 'stdout');
  Object.defineProperty(process, 'stdin', { configurable: true, value: input });
  Object.defineProperty(process, 'stdout', { configurable: true, value: output });
  return () => {
    Object.defineProperty(process, 'stdin', stdin);
    Object.defineProperty(process, 'stdout', stdout);
  };
}

function signalHandlersBeforeStart() {
  return Object.fromEntries(['SIGINT', 'SIGTERM'].map((signal) => [signal, process.listeners(signal)]));
}

function removeNewSignalHandlers(before) {
  for (const [signal, handlers] of Object.entries(before)) {
    for (const handler of process.listeners(signal)) {
      if (!handlers.includes(handler)) process.removeListener(signal, handler);
    }
  }
}

test('startGame starts terminal input, repaints updates, and installs shutdown signals', () => {
  const { calls, input } = createInput();
  const writes = [];
  const timers = [];
  const output = { write: (text) => writes.push(text) };
  const restoreStreams = replaceProcessStreams(input, output);
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  const signals = signalHandlersBeforeStart();
  let controller;

  global.setInterval = (callback, delay) => {
    const timer = { callback, delay };
    timers.push(timer);
    return timer;
  };
  global.clearInterval = () => {};

  try {
    controller = startGame();

    assert.equal(controller.running, true);
    assert.deepEqual(calls.slice(0, 4), [
      ['setRawMode', true],
      ['setEncoding', 'utf8'],
      ['resume'],
      ['on', 'data', controller.handleInput],
    ]);
    assert.equal(timers.length, 1);
    assert.equal(timers[0].delay, 700);
    assert.match(writes[0], /^\u001b\[\?25l\u001b\[2J\u001b\[H┌/);
    assert.equal(process.listeners('SIGINT').length, signals.SIGINT.length + 1);
    assert.equal(process.listeners('SIGTERM').length, signals.SIGTERM.length + 1);

    timers[0].callback();
    assert.equal(writes.length, 2);
  } finally {
    if (controller) controller.stop();
    removeNewSignalHandlers(signals);
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
    restoreStreams();
  }
});

test('startGame quit shuts down terminal resources, restores the terminal, and exits', () => {
  const { calls, input } = createInput();
  const writes = [];
  const output = { write: (text) => writes.push(text) };
  const restoreStreams = replaceProcessStreams(input, output);
  const originalExit = process.exit;
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  const signals = signalHandlersBeforeStart();
  const exits = [];
  let controller;

  process.exit = (code) => exits.push(code);
  global.setInterval = () => ({ timer: true });
  global.clearInterval = () => {};

  try {
    controller = startGame();
    controller.quit();

    assert.equal(controller.running, false);
    assert.deepEqual(exits, [0]);
    assert.equal(writes.at(-1), '\u001b[0m\u001b[?25h\u001b[2J\u001b[H');
    assert.deepEqual(calls.slice(-3), [
      ['removeListener', 'data', controller.handleInput],
      ['setRawMode', false],
      ['pause'],
    ]);
    assert.deepEqual(process.listeners('SIGINT'), signals.SIGINT);
    assert.deepEqual(process.listeners('SIGTERM'), signals.SIGTERM);
  } finally {
    if (controller) controller.stop();
    removeNewSignalHandlers(signals);
    process.exit = originalExit;
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
    restoreStreams();
  }
});

test('startGame signal handlers use the same shutdown lifecycle without exiting tests', () => {
  const { input } = createInput();
  const writes = [];
  const restoreStreams = replaceProcessStreams(input, { write: (text) => writes.push(text) });
  const originalExit = process.exit;
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  const signals = signalHandlersBeforeStart();
  const exits = [];
  let controller;

  process.exit = (code) => exits.push(code);
  global.setInterval = () => ({ timer: true });
  global.clearInterval = () => {};

  try {
    controller = startGame();
    const handler = process.listeners('SIGTERM').find((listener) => !signals.SIGTERM.includes(listener));
    handler();

    assert.equal(controller.running, false);
    assert.deepEqual(exits, [0]);
    assert.equal(writes.at(-1), '\u001b[0m\u001b[?25h\u001b[2J\u001b[H');
    assert.deepEqual(process.listeners('SIGINT'), signals.SIGINT);
    assert.deepEqual(process.listeners('SIGTERM'), signals.SIGTERM);
  } finally {
    if (controller) controller.stop();
    removeNewSignalHandlers(signals);
    process.exit = originalExit;
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
    restoreStreams();
  }
});
