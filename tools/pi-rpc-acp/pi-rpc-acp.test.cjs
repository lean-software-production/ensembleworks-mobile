const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, delimiter } = require('node:path');
const { createInterface } = require('node:readline');
const { once } = require('node:events');

async function prompt(t, trace) {
  const folder = mkdtempSync(join(tmpdir(), 'pi-acp-test-'));
  writeFileSync(join(folder, 'pi'), `#!/usr/bin/env node
const { createInterface } = require('node:readline');
const { setTimeout: delay } = require('node:timers/promises');
createInterface({ input: process.stdin }).on('line', async line => {
  const command = JSON.parse(line);
  if (command.type !== 'prompt') return;
  for (const { wait = 0, ...event } of JSON.parse(process.env.PI_TEST_TRACE)) {
    if (wait) await delay(wait);
    process.stdout.write(JSON.stringify(event) + '\\n');
  }
});
`, { mode: 0o755 });
  const child = spawn(process.execPath, [join(__dirname, 'pi-rpc-acp')], {
    env: { ...process.env, PATH: folder + delimiter + process.env.PATH,
      PI_TEST_TRACE: JSON.stringify(trace) }, stdio: ['pipe', 'pipe', 'pipe']
  });
  const closed = once(child, 'close');
  const reader = createInterface({ input: child.stdout });
  t.after(async () => {
    child.kill();
    await closed;
    reader.close();
    rmSync(folder, { recursive: true, force: true });
  });
  let diagnostics = '';
  child.stderr.on('data', chunk => { diagnostics += chunk; });
  const updates = [];
  const pending = new Map();
  let nextId = 1;
  reader.on('line', line => {
    const message = JSON.parse(line);
    if (message.method === 'session/update') updates.push(message.params.update);
    else if (pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });
  function request(method, params) {
    const id = nextId++;
    return new Promise(resolve => {
      pending.set(id, resolve);
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }
  await request('initialize', { protocolVersion: 1 });
  const session = await request('session/new', { cwd: folder, mcpServers: [] });
  const response = await request('session/prompt', {
    sessionId: session.result.sessionId, prompt: [{ type: 'text', text: 'Return the result.' }]
  });
  assert.equal(diagnostics, '');
  return { response, text: updates.filter(update => update.sessionUpdate === 'agent_message_chunk')
    .map(update => update.content.text).join('') };
}

const text = delta => ({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta } });
const turn = (stopReason, extra = {}) => ({ type: 'turn_end', message: {
  role: 'assistant', stopReason, usage: { input: 10, output: 2 }, ...extra
} });

test('waits for automatic recovery after an empty failed agent run', { timeout: 5000 }, async t => {
  const result = await prompt(t, [
    turn('error', { errorMessage: 'Provider temporarily unavailable' }),
    { type: 'agent_end', willRetry: true },
    { type: 'auto_retry_start', attempt: 1 },
    { ...text('{"task":"verification"}\n'), wait: 20 },
    turn('stop'),
    { type: 'agent_end', willRetry: false },
    { type: 'agent_settled', aborted: false }
  ]);
  assert.equal(result.text, '{"task":"verification"}\n');
  assert.equal(result.response.result.stopReason, 'end_turn');
  assert.equal(result.response.result.usage.inputTokens, 20);
  assert.equal(result.response.result.usage.outputTokens, 4);
});

test('waits for queued work even when agent_end willRetry is false', { timeout: 5000 }, async t => {
  const result = await prompt(t, [
    text('Working\n'), turn('stop'), { type: 'agent_end', willRetry: false },
    { ...text('{"task":"verification"}\n'), wait: 20 }, turn('stop'),
    { type: 'agent_end', willRetry: false }, { type: 'agent_settled', aborted: false }
  ]);
  assert.equal(result.text, 'Working\n{"task":"verification"}\n');
  assert.equal(result.response.result.usage.totalTokens, 24);
});

test('reports the provider error after recovery is exhausted', { timeout: 5000 }, async t => {
  const result = await prompt(t, [
    turn('error', { errorMessage: 'Rate limit exceeded; retry later' }),
    { type: 'agent_end', willRetry: false },
    { type: 'auto_retry_end', success: false, finalError: 'Rate limit exceeded; retry later' },
    { type: 'agent_settled', aborted: false }
  ]);
  assert.equal(result.response.error?.message, 'Rate limit exceeded; retry later');
  assert.equal(result.response.result, undefined);
});

test('propagates an aborted settled run as cancellation', { timeout: 5000 }, async t => {
  const result = await prompt(t, [
    turn('aborted'), { type: 'agent_end', willRetry: false },
    { type: 'agent_settled', aborted: true }
  ]);
  assert.equal(result.response.result.stopReason, 'cancelled');
});

test('does not accept earlier JSON when the final response fails without usage', { timeout: 5000 }, async t => {
  const result = await prompt(t, [
    text('{"task":"verification"}\n'), turn('stop'),
    turn('error', { usage: undefined, errorMessage: 'Provider connection closed' }),
    { type: 'agent_end', willRetry: false }, { type: 'agent_settled', aborted: false }
  ]);
  assert.equal(result.response.error?.message, 'Provider connection closed');
  assert.equal(result.response.result, undefined);
});
