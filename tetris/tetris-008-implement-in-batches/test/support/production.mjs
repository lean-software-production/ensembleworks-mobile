import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
const input = new EventEmitter(), output = new EventEmitter();
let raw = false, timer, frames = [], closed = false;
Object.assign(input, { isTTY: true, setRawMode(v) { raw = v; }, resume() {}, pause() { closed = true; } });
Object.assign(output, { isTTY: true, columns: 40, rows: 24, write(text) {
  if (text.startsWith('\x1b[H')) {
    const plain = text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
    assert.equal(plain.split('\n').length, 24);
    assert.ok(plain.split('\n').every(row => row.length <= 40)); frames.push(plain);
  }
} });
Object.defineProperty(process, 'stdin', { value: input });
Object.defineProperty(process, 'stdout', { value: output });
globalThis.setTimeout = fn => { timer = fn; return 1; };
globalThis.clearTimeout = () => { timer = undefined; };
Math.random = () => 1.5 / 7; // O, via production random source
await import('../../src/main.js');
const key = bytes => input.emit('data', Buffer.from(bytes));
const tick = () => { const fn = timer; timer = undefined; fn?.(); };
const latest = () => frames.at(-1);
const initial = latest(); tick(); assert.notEqual(latest(), initial);
key('\x1b[D\x1b[C\x1b[A'); key('p'); const paused = latest(); tick(); assert.equal(latest(), paused); key('p');
// First piece already fell once; enough soft drops to lock exactly once, not move the next.
key('\x1b[D'.repeat(4)); key('\x1b[B'.repeat(18));
for (const x of [2,4,6,8]) {
  key((x < 4 ? '\x1b[D' : '\x1b[C').repeat(Math.abs(x - 4)));
  key('\x1b[B'.repeat(19));
}
assert.match(latest(), /Score: 300/);
for (let i = 0; i < 10; i++) key('\x1b[B'.repeat(19));
assert.match(latest(), /GAME OVER/); assert.equal(timer, undefined);
key('r'); assert.match(latest(), /Score: 0 \| running/); assert.ok(timer);
key('q'); assert.equal(raw, false); assert.equal(timer, undefined); assert.ok(closed);
process.stderr.write(`Checked ${frames.length} bounded production frames\n`);
// stdout is intentionally the controlled terminal.
process.stderr.write('production lifecycle passed\n');
