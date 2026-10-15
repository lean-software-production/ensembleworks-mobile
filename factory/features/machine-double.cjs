#!/usr/bin/env node
// An external ACP agent double; all controlled behavior lives beside the tests.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createInterface } = require("node:readline");
const send = message => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...message }) + "\n");
const text = value => send({ method: "session/update", params: { sessionId: "double", update: {
  sessionUpdate: "agent_message_chunk", content: { type: "text", text: value }
} } });
async function execute(prompt) {
  const console = { log: value => text(String(value) + "\n") };
const config = JSON.parse(fs.readFileSync(process.env.FACTORY_TEST_CONFIG, "utf8"));
const harness = path.basename(process.argv[1]) === "pi-rpc-acp" ? "pi" : "chosen";
const args = process.argv.slice(2);

let machine = prompt.match(/You are the (\w+)\./)?.[1];
if (machine === "reviewer") machine = `reviewer_${["openai/model", "anthropic/model", "google/model"].indexOf(args[args.indexOf("--model") + 1]) + 1}`;
const cwd = process.cwd();
// The run being invoked keeps its plan with the factory; the test names it.
const planPath = config.planPath;
const priorCalls = fs.existsSync(config.callLog)
  ? fs.readFileSync(config.callLog, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)
  : [];
const planExists = fs.existsSync(planPath);
const plan = planExists ? fs.readFileSync(planPath, "utf8") : "";
const count = spawnSync("git", ["rev-list", "--count", "HEAD"], { cwd, encoding: "utf8" });
const commits = count.status === 0 ? Number(count.stdout) : 0;
fs.appendFileSync(config.callLog, JSON.stringify({ pid: process.pid, harness, machine, prompt, args, cwd, commits, plan }) + "\n");
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
    console.log("The work seems fine, but here is no JSON result.");
    return;
  }
  const validationCount = priorCalls.filter(call => call.machine === "validator" && call.cwd === cwd).length;
  const satisfied = config.validation !== "never" && !(config.validation === "reject-first" && validationCount === 0);
  // Never infer the answer's field from the prompt: routing on an absent field must fail.
  result = {
    [config.validatorField || "satisfied"]: satisfied,
    findings: satisfied ? [] : [{ file: `work-${nextTask}.txt`, issue: "Give the behavior a focused collaborator" }]
  };
  if (config.validatorPrefix) console.log(config.validatorPrefix);
} else if (machine?.startsWith("reviewer_")) {
  const review = config.reviewers[machine];
  if (review.prose && !config.reviewerBarrier) {
    console.log("A report with no JSON result");
    return;
  }
  result = { satisfied: review.satisfied, findings: review.findings };
} else if (machine === "synthesiser" || machine === "arbiter") {
  const count = priorCalls.filter(call => call.machine === machine && call.cwd === cwd).length;
  const satisfied = config.synthesis !== "never" && !(config.synthesis === "reject-first" && count === 0);
  result = { satisfied, findings: satisfied ? [] : [{ issue: "Resolve the synthesiser's finding" }] };
} else {
  throw new Error("No machine role in prompt");
}

if (config.holdMachines?.includes(machine)) {
  if (config.partialText) text(config.doerLines?.[0] ?? "started");
  else console.log(config.doerLines?.[0] ?? "started");
  fs.writeFileSync(path.join(config.promptsDir, `${machine}.waiting`), String(process.pid));
  await new Promise(resolve => {
    const timer = setInterval(() => {
      if (fs.existsSync(path.join(config.promptsDir, `${machine}.release`))) {
        clearInterval(timer); resolve();
      }
    }, 15);
  });
  if (config.doerLines?.[1]) console.log(config.doerLines[1]);
}

if (machine?.startsWith("reviewer_") && config.reviewerBarrier) {
  // An event-driven barrier: no reviewer answers until all three started.
  await new Promise(resolve => {
  const watcher = fs.watch(config.callLog, checkStarted);
  function checkStarted() {
    const started = fs.readFileSync(config.callLog, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)
      .filter(call => call.machine?.startsWith("reviewer_") && call.commits === commits);
    if (new Set(started.map(call => call.machine)).size === 3) {
      if (config.holdOtherReviewers && machine !== "reviewer_2") return;
      watcher.close();
      console.log(config.reviewers[machine].prose ? "A report with no JSON result" : JSON.stringify(result));
      resolve();
    }
  }
  checkStarted();
  });
} else console.log(JSON.stringify(result));
if (machine === "validator" && config.invalidLastVerdict) console.log('{"note":"not a verdict"}');

}
let initialized = false;
let session = false;
let working = false;
createInterface({ input: process.stdin }).on("line", async line => {
  const message = JSON.parse(line);
  const { id, method, params } = message;
  if (method === "initialize") {
    initialized = params.protocolVersion === 1;
    send({ id, result: { protocolVersion: 1, agentCapabilities: {} } });
  } else if (method === "session/new") {
    if (!initialized || params.cwd !== process.cwd()) throw new Error("Invalid ACP session");
    session = true;
    send({ id, result: { sessionId: "double" } });
  } else if (method === "session/prompt") {
    if (!session || params.sessionId !== "double") throw new Error("Invalid ACP prompt");
    working = true;
    await execute(params.prompt.map(block => block.text).join("\n"));
    working = false;
    send({ id, result: { stopReason: "end_turn", usage: { inputTokens: 101, outputTokens: 23 } } });
  } else if (method === "_session/steering") {
    if (!working || params.sessionId !== "double" || !Array.isArray(params.prompt) ||
        params.prompt.some(block => block.type !== "text" || typeof block.text !== "string")) {
      send({ id, error: { code: -32602, message: "Invalid ACP steering" } });
      return;
    }
    const config = JSON.parse(fs.readFileSync(process.env.FACTORY_TEST_CONFIG, "utf8"));
    if (config.steeringResponse === "unsupported") {
      send({ id, error: { code: -32601, message: "Steering unsupported" } });
      return;
    }
    if (config.steeringResponse === "promptRequired") {
      send({ id, result: { outcome: "promptRequired", reason: "noRunningTurn" } });
      return;
    }
    for (const block of params.prompt) text(`heard: ${block.text}\n`);
    send({ id, result: { outcome: "injected" } });
  }
});
process.stdin.on("end", () => process.exit(0));
