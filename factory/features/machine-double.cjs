#!/usr/bin/env node
// This executable and all observation state live outside the copied factory and target.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const config = JSON.parse(fs.readFileSync(process.env.FACTORY_TEST_CONFIG, "utf8"));
const harness = path.basename(process.argv[1]) === "pi-rpc-acp" ? "pi" : "chosen";
const args = process.argv.slice(2);
const { createInterface } = require("node:readline");
const send = message => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...message }) + "\n");
let sessionMeta;
let promptId;
const steering = [];
const emit = text => {
  const content = String(text) + "\n";
  const chunks = config.fragmentOutput ? [content.slice(0, 3), content.slice(3)] : [content];
  for (const chunk of chunks) send({ method: "session/update", params: { sessionId: "fixture", update: {
    sessionUpdate: "agent_message_chunk", content: { type: "text", text: chunk }
  } } });
};
const finish = () => {
  send({ id: promptId, result: { stopReason: "end_turn", usage: { inputTokens: 120, outputTokens: 30 } } });
  promptId = undefined;
};
createInterface({ input: process.stdin }).on("line", line => {
  const request = JSON.parse(line);
  if (request.method === "initialize") {
    if (request.params.protocolVersion !== 1) throw new Error("Expected ACP v1");
    send({ id: request.id, result: { protocolVersion: 1, agentCapabilities: {}, authMethods: [] } });
  } else if (request.method === "session/new") {
    sessionMeta = request.params._meta;
    send({ id: request.id, result: { sessionId: "fixture" } });
  } else if (request.method === "session/prompt") {
    promptId = request.id;
    runPrompt(request.params.prompt.map(block => block.text).join("\n"));
  } else if (request.method === "_session/steering") {
    if (request.params.sessionId !== "fixture") throw new Error("Wrong steering session");
    if (config.steeringRefusal === "unsupported") return send({ id: request.id, error: { code: -32601, message: "Steering is not supported" } });
    if (config.steeringRefusal === "inactive") return send({ id: request.id, result: { outcome: "promptRequired", reason: "noRunningTurn" } });
    if (promptId === undefined) return send({ id: request.id, result: { outcome: "promptRequired", reason: "noRunningTurn" } });
    steering.push(request.params.prompt.map(block => {
      if (block.type !== "text" || typeof block.text !== "string") throw new Error("Expected steering text");
      return block.text;
    }).join("\n"));
    send({ id: request.id, result: { outcome: "injected" } });
  }
});
function runPrompt(prompt) {
let machine = prompt.match(/You are the (\w+)\./)?.[1];
if (machine === "reviewer") machine = `reviewer_${["openai/model", "anthropic/model", "google/model"].indexOf(args[args.indexOf("--model") + 1]) + 1}`;
const cwd = process.cwd();
const configDir = process.env.PI_CODING_AGENT_DIR || process.env.CLAUDE_CONFIG_DIR || process.env.CODEX_HOME || "";
const configDirs = Object.fromEntries(["PI_CODING_AGENT_DIR", "CLAUDE_CONFIG_DIR", "CODEX_HOME"].filter(key => process.env[key]).map(key => [key, process.env[key]]));
if (!machine && configDir) machine = path.basename(configDir);
const ownLogin = !!configDir && ["auth.json", ".credentials.json"].some(file => fs.existsSync(path.join(configDir, file)));
const apiKey = !!process.env.ANTHROPIC_API_KEY;
// The run being invoked keeps its plan with the factory; the test names it.
const planPath = config.planPath;
const priorCalls = fs.existsSync(config.callLog)
  ? fs.readFileSync(config.callLog, "utf8").split("\n").slice(0, -1).filter(Boolean).map(JSON.parse)
  : [];
const planExists = fs.existsSync(planPath);
const plan = planExists ? fs.readFileSync(planPath, "utf8") : "";
const count = spawnSync("git", ["rev-list", "--count", "HEAD"], { cwd, encoding: "utf8" });
const commits = count.status === 0 ? Number(count.stdout) : 0;
fs.appendFileSync(config.callLog, JSON.stringify({ harness, machine, prompt, args, cwd, commits, plan, configDir, ownLogin, apiKey, configDirs, sessionMeta }) + "\n");
fs.mkdirSync(config.promptsDir, { recursive: true });
fs.writeFileSync(path.join(config.promptsDir, `${priorCalls.filter(call => call.machine === machine).length + 1}-${machine}.txt`), prompt);

const prose = config.plannerInProse || config.doerInProse;
const tasks = config.tasks || ["alpha", "beta"];
const nextTask = prose
  ? (plan.includes("Alpha is done.") ? (plan.includes("Beta is done.") ? undefined : "beta") : "alpha")
  : plan.match(/^- \[ \] (.+)$/m)?.[1];
let result;

if (machine === "plan_author") {
  fs.mkdirSync(path.dirname(planPath), { recursive: true });
  if (!planExists) fs.writeFileSync(planPath, `# Comprehensive plan\n\nResponsibilities, contracts and acceptance examples.\n\n${tasks.map(task => `- [ ] ${task}`).join("\n")}\n`);
  else fs.appendFileSync(planPath, "\nRevised contracts and acceptance examples.\n");
  if (config.planAuthorSkipsTask && planExists) {
    fs.writeFileSync(planPath, fs.readFileSync(planPath, "utf8").replace("- [ ] alpha", "- [x] alpha"));
  }
  result = { changes: "Reviewed gameplay contracts and acceptance examples; preserve task identities." };
} else if (["plan_gameplay", "plan_objects", "plan_testability", "plan_terminal"].includes(machine)) {
  result = {
    summary: `${machine} reviewed the plan's contracts and acceptance examples.`,
    findings: config.planObjection && machine === "plan_testability"
      ? [{ id: "test-boundary", issue: "Clarify an acceptance boundary", section: "Acceptance", severity: "blocking", recommendation: "Add a behavior example" }]
      : []
  };
  if (config.malformedPlanReport && machine === "plan_testability") delete result.findings;
} else if (machine === "plan_synthesiser") {
  const count = priorCalls.filter(call => call.machine === machine).length;
  const satisfied = config.planSynthesis !== "never" && !(config.planSynthesis === "reject-first" && count === 0);
  const reports = JSON.parse(prompt.match(/Branch results:\n([^\n]+)/)[1]);
  result = {
    satisfied, summary: "Reconciled the plan review reports.",
    findings: satisfied ? [] : [{ issue: "Resolve the plan synthesis finding" }],
    dispositions: Object.entries(reports).flatMap(([reviewer, report]) => report.findings.map(finding => ({
      reviewer, id: finding.id, status: satisfied ? "accepted_limitation" : "revise",
      reason: satisfied ? "This optional boundary does not prevent the planned behavior." : "Add the missing acceptance example."
    })))
  };
  if (config.missingPlanDisposition) result.dispositions = [];
} else if (machine === "plan_validator") {
  const count = priorCalls.filter(call => call.machine === machine).length;
  const replan = config.planDefectFirst === true && count === 0;
  const retry = !replan && (config.validation === "never" || (config.validation === "reject-first" && count === 0));
  result = { satisfied: !replan && !retry, retry, replan, findings: replan
    ? [{ issue: "The plan's input contract omits a split sequence", section: "Input contract" }]
    : retry ? [{ issue: "Implement the agreed acceptance example" }] : [], checks: ["Checked the current task"] };
} else if (machine === "planner") {
  fs.mkdirSync(path.dirname(planPath), { recursive: true });
  if (!planExists) {
    fs.writeFileSync(planPath, config.plannerInProse
      ? "Alpha comes first. Beta follows.\n"
      : `# Plan\n\n${tasks.map(task => `- [ ] ${task}`).join("\n")}\n`);
    result = { complete: false };
  } else if (prompt.includes("The task's work has been committed")) {
    if (!nextTask) throw new Error("Planner received committed-work notification without a pending task");
    if (prose) {
      fs.appendFileSync(planPath, nextTask === "alpha" ? "Alpha is done.\n" : "Beta is done.\n");
      result = { complete: nextTask === "beta" };
    } else {
      const updated = plan.replace(`- [ ] ${nextTask}`, `- [x] ${nextTask}`);
      fs.writeFileSync(planPath, updated);
      result = { complete: !updated.match(/^- \[ \] /m) };
    }
  } else {
    result = { complete: !nextTask };
  }
} else if (machine === "doer") {
  if (!nextTask) throw new Error("Doer called with no pending task");
  const original = `work-${nextTask}.txt`;
  const file = config.doerRename ? `work-${nextTask}-renamed.txt` : config.writeSentinel ? "SENTINEL" : original;
  if (config.doerRename) {
    const moved = spawnSync("git", ["mv", "--", original, file], { cwd, encoding: "utf8" });
    if (moved.status !== 0) throw new Error(`git mv failed: ${moved.stderr}`);
  }
  const findings = JSON.parse(prompt.match(/Validator findings:\n([^\n]+)/)?.[1] ?? "[]");
  if (findings.length) {
    const subtasks = findings.map(finding => `  - [x] ${finding.issue}`).join("\n");
    fs.writeFileSync(planPath, plan.replace(`- [ ] ${nextTask}`, `- [ ] ${nextTask}\n${subtasks}`));
  }
  if (!config.doerNoChanges) fs.writeFileSync(path.join(cwd, file), `${nextTask}\n${findings.length ? "corrected\n" : ""}`);
  if (config.largeLockfile) fs.writeFileSync(path.join(cwd, "package-lock.json"), config.largeLockfile);
  // Answer regardless of which result fields the prompt asks for. Do not mark the parent done.
  result = { task: nextTask };
} else if (machine === "validator") {
  if (config.validatorInProse) {
    emit("The work seems fine, but here is no JSON result.");
    return finish();
  }
  const validationCount = priorCalls.filter(call => call.machine === "validator" && call.cwd === cwd).length;
  const satisfied = config.validation !== "never" && !(config.validation === "reject-first" && validationCount === 0);
  // Never infer the answer's field from the prompt: routing on an absent field must fail.
  result = {
    [config.validatorField || "satisfied"]: satisfied,
    findings: satisfied ? [] : [{ file: `work-${nextTask}.txt`, issue: "Give the behavior a focused collaborator" }]
  };
  if (config.validatorPrefix) emit(config.validatorPrefix);
} else if (machine?.startsWith("reviewer_")) {
  const review = config.reviewers[machine];
  if (review.prose && !config.reviewerBarrier) {
    emit("A report with no JSON result");
    return finish();
  }
  result = { satisfied: review.satisfied, findings: review.findings };
} else if (machine === "synthesiser" || machine === "arbiter") {
  const count = priorCalls.filter(call => call.machine === machine && call.cwd === cwd).length;
  const satisfied = config.synthesis !== "never" && !(config.synthesis === "reject-first" && count === 0);
  result = { satisfied, findings: satisfied ? [] : [{ issue: "Resolve the synthesiser's finding" }] };
} else {
  throw new Error("No machine role in prompt");
}

if (machine?.startsWith("reviewer_") && config.reviewerBarrier) {
  // An event-driven barrier: no reviewer answers until all three started.
  const watcher = fs.watch(config.callLog, checkStarted);
  if (config.holdOtherReviewers && machine !== "reviewer_2") {
    process.on("SIGTERM", () => {
      fs.appendFileSync(path.join(path.dirname(config.callLog), "reviewers-stopped.txt"), machine + "\n");
      watcher.close();
      process.exit(0);
    });
  }
  function checkStarted() {
    const started = fs.readFileSync(config.callLog, "utf8").split("\n").slice(0, -1).filter(Boolean).map(JSON.parse)
      .filter(call => call.machine?.startsWith("reviewer_") && call.commits === commits);
    if (new Set(started.map(call => call.machine)).size === 3) {
      if (config.holdOtherReviewers && machine !== "reviewer_2") return;
      watcher.close();
      emit(config.reviewers[machine].prose ? "A report with no JSON result" : JSON.stringify(result));
      finish();
    }
  }
  checkStarted();
} else {
  const finishTurn = () => {
    for (const message of steering.splice(0)) emit(`heard: ${JSON.stringify(message)}`);
    if (machine === "doer" && config.doerLines?.[1]) emit(config.doerLines[1]);
    emit(JSON.stringify(result));
    if (machine === "validator" && config.invalidLastVerdict) emit('{"note":"not a verdict"}');
    finish();
  };
  const held = config.holdMachine === machine || (config.holdMachine === "reviewers" && machine?.startsWith("reviewer_"));
  if (machine === "doer" && (config.doerLines || held)) emit(config.doerLines?.[0] ?? "started");
  if (held) {
    fs.writeFileSync(path.join(path.dirname(config.callLog), `held-${machine}`), String(process.pid));
    const interval = setInterval(() => {
      if (fs.existsSync(path.join(path.dirname(config.callLog), "release-machines"))) { clearInterval(interval); finishTurn(); }
    }, 20);
  } else finishTurn();
}
}
