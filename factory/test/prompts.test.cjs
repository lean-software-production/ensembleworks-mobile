const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resultPrompt, machinePrompt } = require('../src/prompts');

test('reviewer final instruction reinforces the report schema instead of requesting a second summary', () => {
  const prompt = resultPrompt([], 'plan_reviewer');
  assert.match(prompt, /exactly one result object/);
  assert.match(prompt, /do not append a second JSON/);
  assert.match(prompt, /"summary" \(string\) and "findings" \(array/);
  assert.match(prompt, /Keep these fields in the final result itself/);
  assert.doesNotMatch(prompt, /JSON describing what you did/);
});
test('role contracts and line routing fields are both retained', () => {
  assert.match(resultPrompt(['satisfied'], 'plan_synthesiser'), /"dispositions"/);
  const validator = resultPrompt(['satisfied', 'retry', 'replan'], 'plan_validator');
  assert.match(validator, /exactly one true/);
  assert.match(validator, /these decide which assembly-line edge runs next/);
  assert.match(resultPrompt([], 'plan_author'), /"changes"/);
  assert.match(resultPrompt(['complete'], 'custom'), /boolean field "complete"/);
  assert.match(machinePrompt('{{plan}}', { plan: '{{seed}}' }), /^\{\{seed\}\}$/);
});
