#!/usr/bin/env node
// An ordinary ACP machine: checks the checkpoint without calling a model.
const { existsSync, readFileSync } = require("node:fs");
const { createInterface } = require("node:readline");
const send = message => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...message }) + "\n");
createInterface({ input: process.stdin }).on("line", line => {
  const { id, method, params } = JSON.parse(line);
  if (method === "initialize") send({ id, result: { protocolVersion: 1, agentCapabilities: {}, authMethods: [] } });
  else if (method === "session/new") send({ id, result: { sessionId: "gate" } });
  else if (method === "session/prompt") {
    const prompt = params.prompt.filter(block => block.type === "text").map(block => block.text).join("\n");
    const plan = prompt.match(/^Plan: (.+)$/m)?.[1];
    const review = prompt.match(/^Plan review state: (.+)$/m)?.[1];
    if (!plan || !review) return send({ id, error: { code: -32602, message: "The plan gate needs the plan and review-state paths." } });
    const state = existsSync(review) ? JSON.parse(readFileSync(review, "utf8")) : undefined;
    send({ method: "session/update", params: { sessionId: "gate", update: {
      sessionUpdate: "agent_message_chunk", content: { type: "text", text: JSON.stringify({ ready: existsSync(plan) && state?.status === "accepted" }) + "\n" }
    } } });
    send({ id, result: { stopReason: "end_turn", usage: { inputTokens: 0, outputTokens: 0 } } });
  } else if (id !== undefined) send({ id, error: { code: -32601, message: `Unknown method: ${method}` } });
});
