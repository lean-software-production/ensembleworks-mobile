import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chmodSync, copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const folder = path.dirname(fileURLToPath(import.meta.url));
const usage = { input: 100, output: 20, cacheRead: 3, cacheWrite: 4 };
const message = (text, extra = {}) => ({ role: 'assistant', content: [{ type: 'text', text }], stopReason: 'stop', usage, ...extra });
const delta = text => ({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: text } });
const ended = message => [{ type: 'message_end', message }, { type: 'turn_end', message }];
const settle = [{ type: 'agent_end', willRetry: false }, { type: 'agent_settled', aborted: false }];

async function runBridge(t, batches) {
  const workspace = mkdtempSync(path.join(tmpdir(), 'pi-bridge-test-'));
  const events = path.join(workspace, 'events.json');
  const pi = path.join(workspace, 'pi');
  writeFileSync(events, JSON.stringify(batches));
  copyFileSync(path.join(folder, 'test', 'pi-double.cjs'), pi);
  chmodSync(pi, 0o755);
  const child = spawn(process.execPath, [path.join(folder, 'pi-rpc-acp')], {
    cwd: workspace,
    env: { ...process.env, PI_BRIDGE_TEST_EVENTS: events, PATH: `${workspace}${path.delimiter}${process.env.PATH}` }
  });
  const closed = once(child, 'close');
  t.after(async () => { child.kill(); await closed; rmSync(workspace, { recursive: true, force: true }); });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  const pending = new Map();
  const updates = [];
  let id = 0;
  createInterface({ input: child.stdout }).on('line', line => {
    const event = JSON.parse(line);
    if (event.method === 'session/update') updates.push(event.params.update);
    else if (pending.has(event.id)) { pending.get(event.id)(event); pending.delete(event.id); }
  });
  child.on('error', error => { throw error; });
  const request = (method, params) => new Promise(resolve => {
    const key = ++id;
    pending.set(key, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: key, method, params }) + '\n');
  });
  await request('initialize', { protocolVersion: 1 });
  const session = await request('session/new', { cwd: workspace, mcpServers: [] });
  const response = await request('session/prompt', { sessionId: session.result.sessionId, prompt: [{ type: 'text', text: 'Do the task.' }] });
  assert.equal(stderr, '');
  return { response, text: updates.filter(update => update.sessionUpdate === 'agent_message_chunk').map(update => update.content.text).join('') };
}

test('waits for automatic recovery after agent_end and totals every turn', { timeout: 5000 }, async t => {
  const failed = message('', { content: [], stopReason: 'error', errorMessage: '429 rate limited' });
  const final = message('{"task":"alpha"}');
  const result = await runBridge(t, [
    [...ended(failed), { type: 'agent_end', willRetry: true }],
    [{ type: 'message_start', message: { role: 'assistant', content: [] } }, delta('{"task":"alpha"}'), ...ended(final), ...settle]
  ]);
  assert.equal(result.text, '{"task":"alpha"}');
  assert.equal(result.response.result.usage.inputTokens, 200);
  assert.equal(result.response.result.usage.outputTokens, 40);
});

test('forwards authoritative final text when no text deltas were sent', { timeout: 5000 }, async t => {
  const result = await runBridge(t, [[...ended(message('{"task":"alpha"}')), ...settle]]);
  assert.equal(result.text, '{"task":"alpha"}');
});

test('fills an incomplete text stream without duplicating the prefix', { timeout: 5000 }, async t => {
  const result = await runBridge(t, [[delta('{"task":'), ...ended(message('{"task":"alpha"}')), ...settle]]);
  assert.equal(result.text, '{"task":"alpha"}');
});

test('reports the provider error and usage after retries are exhausted', { timeout: 5000 }, async t => {
  const failed = message('', { content: [], stopReason: 'error', errorMessage: '429 free-model quota exhausted' });
  const result = await runBridge(t, [[...ended(failed), { type: 'auto_retry_end', success: false, finalError: failed.errorMessage }, ...settle]]);
  assert.match(result.response.error.message, /429 free-model quota exhausted/);
  assert.equal(result.response.error.data.usage.inputTokens, 100);
});

test('does not accept earlier JSON when the final assistant turn failed', { timeout: 5000 }, async t => {
  const failed = message('', { content: [], stopReason: 'error', errorMessage: 'provider connection failed' });
  const result = await runBridge(t, [[delta('{"task":"alpha"}'), ...ended(message('{"task":"alpha"}'))], [
    { type: 'message_start', message: { role: 'assistant', content: [] } }, ...ended(failed), ...settle
  ]]);
  assert.match(result.response.error.message, /provider connection failed/);
});

test('reports a token limit rather than accepting a truncated answer', { timeout: 5000 }, async t => {
  const result = await runBridge(t, [[...ended(message('{"task":', { stopReason: 'length' })), ...settle]]);
  assert.match(result.response.error.message, /token limit/i);
});

test('an aborted settled run returns cancelled with its usage', { timeout: 5000 }, async t => {
  const result = await runBridge(t, [[...ended(message('', { stopReason: 'aborted' })), { type: 'agent_settled', aborted: true }]]);
  assert.equal(result.response.result.stopReason, 'cancelled');
  assert.equal(result.response.result.usage.inputTokens, 100);
});

test('separates assistant messages so the final JSON remains a complete line', { timeout: 5000 }, async t => {
  const result = await runBridge(t, [[delta('Working'), ...ended(message('Working'))], [
    { type: 'message_start', message: { role: 'assistant', content: [] } },
    delta('{"task":"alpha"}'), ...ended(message('{"task":"alpha"}')), ...settle
  ]]);
  assert.equal(result.text, 'Working\n{"task":"alpha"}');
});
