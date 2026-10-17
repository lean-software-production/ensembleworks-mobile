const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, chmodSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, dirname } = require('node:path');
const { callMachine } = require('../src/acp');
const { RunRecord, readRecord } = require('../src/record');

async function invoke(t, usage, output = '{"complete":true}', stopReason = 'end_turn') {
  const folder = mkdtempSync(join(tmpdir(), 'factory-telemetry-'));
  const executable = join(folder, 'agent.cjs');
  const name = `telemetry-${process.pid}-${Math.random().toString(36).slice(2)}`;
  const record = new RunRecord(name);
  t.after(() => {
    rmSync(folder, { recursive: true, force: true });
    rmSync(dirname(record.path), { recursive: true, force: true });
  });
  writeFileSync(executable, `#!/usr/bin/env node
const { createInterface } = require('node:readline');
const send = m => process.stdout.write(JSON.stringify({jsonrpc:'2.0',...m})+'\\n');
createInterface({input:process.stdin}).on('line',line=>{
 const m=JSON.parse(line);
 if(m.method==='initialize') send({id:m.id,result:{protocolVersion:1}});
 else if(m.method==='session/new') send({id:m.id,result:{sessionId:'test'}});
 else if(m.method==='session/prompt') {
  send({method:'session/update',params:{sessionId:'test',update:{sessionUpdate:'agent_message_chunk',content:{type:'text',text:${JSON.stringify(output)}}}}});
  send({id:m.id,result:${JSON.stringify({ usage, stopReason, _meta: { modelStopReasons: ['length'] } })}});
 }
});
`);
  chmodSync(executable, 0o755);
  const machine = { name: 'validator', role: 'validator', folder, instructions: '', harness: executable };
  let error;
  let result;
  try { result = await callMachine(machine, folder, 'check', record, new AbortController().signal, process.env, new Map()); }
  catch (caught) { error = caught; }
  return { events: readRecord(name), result, error };
}

test('ACP usage records retain measured cache counters including zero', async t => {
  const { events, result, error } = await invoke(t, { inputTokens: 3, outputTokens: 4, cachedReadTokens: 25, cachedWriteTokens: 0 });
  assert.equal(error, undefined);
  assert.deepEqual(result, { complete: true });
  const usage = events.find(event => event.type === 'usage');
  assert.equal(usage.cachedReadTokens, 25);
  assert.equal(usage.cachedWriteTokens, 0);
});

test('ACP usage records keep unknown cache counters absent and reject invalid counters', async t => {
  const { events } = await invoke(t, { inputTokens: 3, outputTokens: 4 });
  const usage = events.find(event => event.type === 'usage');
  assert.equal(Object.hasOwn(usage, 'cachedReadTokens'), false);
  assert.equal(Object.hasOwn(usage, 'cachedWriteTokens'), false);
  const { error } = await invoke(t, { inputTokens: 3, outputTokens: 4, cachedReadTokens: -1 });
  assert.match(error.message, /Invalid ACP cache token usage/);
});

test('malformed JSON stops the call and saves bounded output and stop diagnostics', async t => {
  const output = 'progress '.repeat(1000) + '\n{"satisfied":true,"checks":[';
  const { events, error } = await invoke(t, { inputTokens: 3, outputTokens: 4 }, output, 'max_tokens');
  assert.match(error.message, /Could not read the validator's result/);
  const diagnostic = events.find(event => event.type === 'diagnostic');
  assert.equal(diagnostic.outputBytes, Buffer.byteLength(output));
  assert.equal(diagnostic.outputTail, output.slice(-2048));
  assert.equal(diagnostic.stopReason, 'max_tokens');
  assert.deepEqual(diagnostic.modelStopReasons, ['length']);
  assert.equal(events.at(-1).status, 'failed');
  assert.ok(events.some(event => event.type === 'usage'));
});


test('a trailing metadata object is never silently replaced with earlier valid findings', async t => {
  const { PlanReview } = require('../src/plan-review');
  const output = '{"summary":"Reviewed","findings":[{"id":"S1","issue":"Boundary unclear"}]}\n{"result":"plan_review_complete","blocking":0}';
  const { result, error } = await invoke(t, { inputTokens: 3, outputTokens: 4 }, output);
  assert.equal(error, undefined);
  assert.deepEqual(result, { result: 'plan_review_complete', blocking: 0 });
  const folder = mkdtempSync(join(tmpdir(), 'factory-result-contract-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const review = new PlanReview(join(folder, 'plan.md'), 3);
  assert.throws(() => review.recordReports({ plan_reviewer_opus: result }), /Could not read the plan_reviewer_opus's plan findings/);
});
