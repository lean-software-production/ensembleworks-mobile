const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, writeFileSync, chmodSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, delimiter } = require('node:path');
const { createInterface } = require('node:readline');
const { once } = require('node:events');

const delta = text => ({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: text } });
const end = role => ({ type: 'message_end', message: { role } });

async function stream(t, events, usageTurns = [{ input: 3, output: 4 }]) {
  const folder = mkdtempSync(join(tmpdir(), 'pi-acp-boundaries-'));
  const executable = join(folder, 'pi');
  writeFileSync(executable, `#!/usr/bin/env node
const { createInterface } = require('node:readline');
createInterface({ input: process.stdin }).on('line', line => {
  if (JSON.parse(line).type !== 'prompt') return;
  for (const event of ${JSON.stringify([...events, ...usageTurns.map(usage => ({ type: 'turn_end', message: { role: 'assistant', usage } })), { type: 'agent_end' }, { type: 'agent_settled' }])}) {
    process.stdout.write(JSON.stringify(event) + '\\n');
  }
});
`);
  chmodSync(executable, 0o755);
  const child = spawn(process.execPath, [join(__dirname, 'pi-rpc-acp')], {
    env: { ...process.env, PATH: `${folder}${delimiter}${process.env.PATH}` }
  });
  const closed = once(child, 'close');
  t.after(async () => {
    child.stdin.end();
    await closed;
    rmSync(folder, { recursive: true, force: true });
  });
  let diagnostic = '';
  child.stderr.on('data', chunk => { diagnostic += chunk.toString(); });
  const messages = [];
  const pending = new Map();
  createInterface({ input: child.stdout }).on('line', line => {
    const message = JSON.parse(line);
    messages.push(message);
    if (message.id !== undefined) {
      const waiter = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) waiter?.reject(new Error(message.error.message));
      else waiter?.resolve(message.result);
    }
  });
  child.on('error', error => { for (const request of pending.values()) request.reject(error); });
  child.on('close', () => { for (const request of pending.values()) request.reject(new Error(diagnostic || 'Bridge exited')); });
  let id = 0;
  const request = (method, params) => new Promise((resolve, reject) => {
    const key = ++id;
    pending.set(key, { resolve, reject });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: key, method, params }) + '\n');
  });
  await request('initialize', { protocolVersion: 1, clientCapabilities: {} });
  const { sessionId } = await request('session/new', { cwd: folder, mcpServers: [] });
  const response = await request('session/prompt', { sessionId, prompt: [{ type: 'text', text: 'Perform the task and report JSON.' }] });

  const text = messages.filter(message => message.params?.update?.sessionUpdate === 'agent_message_chunk')
    .map(message => message.params.update.content.text).join('');
  return { text, response };
}

test('separates progress messages from a fragmented final JSON result', { timeout: 10000 }, async t => {
  const { text } = await stream(t, [
    delta('I’ll inspect the plan.'), end('assistant'), end('toolResult'),
    delta('The tests pass.'), end('assistant'),
    delta('{"task":'), delta('"Introduce tetromino definitions",'), delta('"tests":"npm test"}'), end('assistant')
  ]);
  assert.equal(text, 'I’ll inspect the plan.\nThe tests pass.\n{"task":"Introduce tetromino definitions","tests":"npm test"}\n');
  assert.equal(JSON.parse(text.trimEnd().split('\n').at(-1)).task, 'Introduce tetromino definitions');
});

test('preserves existing newlines without adding blank lines', { timeout: 10000 }, async t => {
  assert.equal((await stream(t, [delta('café checked\n'), end('assistant'), end('assistant'), delta('{"complete":false}\n'), end('assistant')])).text,
    'café checked\n{"complete":false}\n');
});

test('does not turn commentary containing JSON into a standalone result', { timeout: 10000 }, async t => {
  const { text } = await stream(t, [delta('The answer might be {"complete":true}'), end('assistant')]);
  assert.throws(() => JSON.parse(text.trim()), SyntaxError);
});


test('aggregates reported cache usage and preserves explicit zero', { timeout: 10000 }, async t => {
  const { response } = await stream(t, [], [
    { input: 3, output: 4, cacheRead: 12, cacheWrite: 0 },
    { input: 5, output: 6, cacheRead: 20, cacheWrite: 0 }
  ]);
  assert.deepEqual(response.usage, { inputTokens: 8, outputTokens: 10, cachedReadTokens: 32, cachedWriteTokens: 0, totalTokens: 50 });
});

test('does not report partial or missing cache measurements as complete totals', { timeout: 10000 }, async t => {
  const { response } = await stream(t, [], [
    { input: 3, output: 4, cacheRead: 12, cacheWrite: 0 },
    { input: 5, output: 6, cacheWrite: 0 }
  ]);
  assert.deepEqual(response.usage, { inputTokens: 8, outputTokens: 10, cachedWriteTokens: 0 });
});

test('does not invent usage when no model turn reported it', { timeout: 10000 }, async t => {
  const { response } = await stream(t, [], []);
  assert.equal(response.usage, undefined);
});

test('retains the model stop reason separately from the ACP turn boundary', { timeout: 10000 }, async t => {
  const { response } = await stream(t, [
    { type: 'turn_end', message: { role: 'assistant', stopReason: 'length', usage: { input: 3, output: 4 } } }
  ], []);
  assert.equal(response.stopReason, 'end_turn');
  assert.deepEqual(response._meta.modelStopReasons, ['length']);
});

test('does not present a partial aggregate when one model turn has no usage', { timeout: 10000 }, async t => {
  const { response } = await stream(t, [
    { type: 'turn_end', message: { role: 'assistant', stopReason: 'error' } }
  ], [{ input: 3, output: 4, cacheRead: 0, cacheWrite: 0 }]);
  assert.equal(response.usage, undefined);
  assert.deepEqual(response._meta.modelStopReasons, ['error']);
});

test('reports a turn that pi ended with an error instead of finishing it', { timeout: 10000 }, async t => {
  await assert.rejects(stream(t, [
    delta('I’ll verify the floor.'),
    { type: 'message_end', message: { role: 'assistant', stopReason: 'error', errorMessage: 'Provider returned error 502' } }
  ]), /pi stopped with an error: Provider returned error 502/);
});

test('reports a turn that ran out of output tokens', { timeout: 10000 }, async t => {
  await assert.rejects(stream(t, [
    delta('{"task":'),
    { type: 'message_end', message: { role: 'assistant', stopReason: 'length' } }
  ]), /pi ran out of output tokens/);
});

test('finishes a turn whose last message stopped normally after an earlier error was retried', { timeout: 10000 }, async t => {
  const { text } = await stream(t, [
    { type: 'message_end', message: { role: 'assistant', stopReason: 'error', errorMessage: 'overloaded' } },
    delta('{"complete":true}'),
    { type: 'message_end', message: { role: 'assistant', stopReason: 'stop' } }
  ]);
  assert.equal(text.trim(), '{"complete":true}');
});

test('waits for pi to settle when it retries after an attempt ends in an error', { timeout: 10000 }, async t => {
  const { text } = await stream(t, [
    delta('I’ll check the plan.'),
    { type: 'message_end', message: { role: 'assistant', stopReason: 'error', errorMessage: '429 rate limit' } },
    { type: 'agent_end', willRetry: false },
    { type: 'auto_retry_start', attempt: 1, maxAttempts: 8, delayMs: 5000, errorMessage: '429 rate limit' },
    delta('{"complete":false}'),
    { type: 'message_end', message: { role: 'assistant', stopReason: 'stop' } },
    { type: 'auto_retry_end', success: true, attempt: 1 }
  ]);
  assert.equal(text.trim().split('\n').at(-1), '{"complete":false}');
});
