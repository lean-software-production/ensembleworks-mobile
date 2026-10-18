import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { renderFrame, WIDTH, HEIGHT } from '../src/render.js';
import { start } from '../src/index.js';

function lines(frame) {
  return frame.trimEnd().split('\n');
}

test('pure empty board frame has 20 visible rows, borders and status within 24 rows', () => {
  const frame = renderFrame();
  const visible = lines(frame);
  assert.equal(visible.length, 24);
  assert.equal(visible[0], `+${'-'.repeat(WIDTH * 2)}+`);
  assert.equal(visible[HEIGHT + 1], visible[0]);
  assert.deepEqual(visible.slice(1, HEIGHT + 1), Array(HEIGHT).fill(`|${' '.repeat(WIDTH * 2)}|`));
  assert.match(visible[22], /^Score: 0$/);
  assert.match(visible[23], /Arrows:.*Q: quit/);
  assert.ok(visible.every(line => line.length <= 50));
  assert.equal(renderFrame(), frame);
});

test('start writes one bounded frame to an injected non-TTY stream', () => {
  let output = '';
  start({ output: { write: text => { output += text; } } });
  assert.equal(lines(output).length, 24);
  assert.equal(output.split('\n').length, 24);
  assert.ok(!output.endsWith('\n'));
});

test('npm start succeeds without a terminal and emits a bounded frame', () => {
  const result = spawnSync('npm', ['start'], { encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.split('\n').length, 24);
  assert.ok(result.stdout.startsWith(`+${'-'.repeat(WIDTH * 2)}+\n`));
  assert.ok(!result.stdout.endsWith('\n'));
  assert.match(result.stdout, /Score: 0/);
  assert.match(result.stdout, /Arrows:/);
});
