#!/usr/bin/env node
// This executable and all observation state live outside the copied factory and target.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const config = JSON.parse(fs.readFileSync(process.env.FACTORY_TEST_CONFIG, "utf8"));
const harness = path.basename(process.argv[1]) === "pi" ? "pi" : "chosen";
const prompt = process.argv.slice(2).join(" ");
const machine = prompt.match(/You are the (planner|doer|validator)\./)?.[1];
const cwd = process.cwd();
const planPath = path.join(cwd, ".factory", "plan.md");
const priorCalls = fs.existsSync(config.callLog)
  ? fs.readFileSync(config.callLog, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)
  : [];
const planExists = fs.existsSync(planPath);
const plan = planExists ? fs.readFileSync(planPath, "utf8") : "";
const count = spawnSync("git", ["rev-list", "--count", "HEAD"], { cwd, encoding: "utf8" });
const commits = count.status === 0 ? Number(count.stdout) : 0;
fs.appendFileSync(config.callLog, JSON.stringify({ harness, machine, prompt, cwd, commits, plan }) + "\n");
fs.mkdirSync(config.promptsDir, { recursive: true });
fs.writeFileSync(path.join(config.promptsDir, `${priorCalls.length + 1}-${machine}.txt`), prompt);

const prose = config.plannerInProse || config.doerInProse;
const tasks = config.tasks || ["alpha", "beta"];
const nextTask = prose
  ? (plan.includes("Alpha is done.") ? (plan.includes("Beta is done.") ? undefined : "beta") : "alpha")
  : plan.match(/^- \[ \] (.+)$/m)?.[1];
let result;

if (machine === "planner") {
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
  // Answer regardless of which result fields the prompt asks for. Do not mark the parent done.
  result = { task: nextTask };
} else if (machine === "validator") {
  if (config.validatorInProse) {
    console.log("The work seems fine, but here is no JSON result.");
    process.exit(0);
  }
  const validationCount = priorCalls.filter(call => call.machine === "validator" && call.cwd === cwd).length;
  const satisfied = config.validation !== "never" && !(config.validation === "reject-first" && validationCount === 0);
  // Never infer the answer's field from the prompt: routing on an absent field must fail.
  result = {
    [config.validatorField || "satisfied"]: satisfied,
    findings: satisfied ? [] : [{ file: `work-${nextTask}.txt`, issue: "Give the behavior a focused collaborator" }]
  };
  if (config.validatorPrefix) console.log(config.validatorPrefix);
} else {
  throw new Error("No machine role in prompt");
}

console.log(JSON.stringify(result));
if (machine === "validator" && config.invalidLastVerdict) console.log('{"note":"not a verdict"}');
