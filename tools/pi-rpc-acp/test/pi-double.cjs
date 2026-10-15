#!/usr/bin/env node
const { readFileSync } = require('node:fs');
const { createInterface } = require('node:readline');
const batches = JSON.parse(readFileSync(process.env.PI_BRIDGE_TEST_EVENTS, 'utf8'));
const send = event => process.stdout.write(JSON.stringify(event) + '\n');
createInterface({ input: process.stdin }).on('line', async line => {
  const command = JSON.parse(line);
  if (command.type !== 'prompt') return;
  send({ type: 'response', id: command.id, success: true });
  for (const batch of batches) {
    for (const event of batch) send(event);
    await new Promise(resolve => setTimeout(resolve, 15));
  }
});
