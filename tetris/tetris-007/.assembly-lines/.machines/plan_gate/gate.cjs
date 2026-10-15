#!/usr/bin/env node
// The local checkpoint is an ACP agent too; it uses no model tokens.
const { existsSync, readFileSync } = require("node:fs");
const { createInterface } = require("node:readline");
const send = msg => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...msg }) + "\n");
createInterface({ input: process.stdin }).on("line", line => {
  const { id, method, params } = JSON.parse(line);
  if (method === "initialize") send({ id, result: { protocolVersion: 1, agentCapabilities: {} } });
  else if (method === "session/new") send({ id, result: { sessionId: "gate" } });
  else if (method === "session/prompt") {
    const prompt = params.prompt.map(block => block.text).join("\n");
    const plan = prompt.match(/^Plan: (.+)$/m)?.[1];
    const review = prompt.match(/^Plan review state: (.+)$/m)?.[1];
    if (!plan || !review) throw new Error("The plan gate needs the plan and review-state paths.");
    const state = existsSync(review) ? JSON.parse(readFileSync(review, "utf8")) : undefined;
    send({ method: "session/update", params: { sessionId: "gate", update: {
      sessionUpdate: "agent_message_chunk", content: { type: "text", text: JSON.stringify({ ready: existsSync(plan) && state?.status === "accepted" }) + "\n" }
    } } });
    send({ id, result: { stopReason: "end_turn", usage: { inputTokens: 0, outputTokens: 0 } } });
  }
});
