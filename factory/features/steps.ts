import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import {
  chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync,
  readdirSync, rmSync, symlinkSync, writeFileSync
} from "node:fs";
import { delimiter, dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { FactoryWorld } from "./world";

const identity = {
  GIT_AUTHOR_NAME: "Factory test", GIT_AUTHOR_EMAIL: "factory@example.test",
  GIT_COMMITTER_NAME: "Factory test", GIT_COMMITTER_EMAIL: "factory@example.test"
};
const run = (cwd: string, command: string, args: string[] = []): string => {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", env: { ...process.env, ...identity } });
  assert.equal(result.status, 0, `${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
};
const source = resolve(__dirname, "..");

interface MachineCall {
  harness: string;
  machine: string;
  prompt: string;
  args: string[];
  cwd: string;
  commits: number;
  plan: string;
}
function calls(world: FactoryWorld, machine?: string): MachineCall[] {
  if (!existsSync(world.callLog)) return [];
  const entries = readFileSync(world.callLog, "utf8").trim().split("\n")
    .filter(Boolean).map((line) => JSON.parse(line) as MachineCall);
  return machine ? entries.filter((call) => call.machine === machine) : entries;
}
function machineConfig(world: FactoryWorld, name: string, changes: Record<string, unknown>): void {
  const path = join(world.factoryDir, name, "machine.json");
  const config = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { role: name };
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) delete config[key];
    else config[key] = value;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n");
}
function selectTarget(world: FactoryWorld, path: string): void {
  world.codebase = path;
  world.planPath = join(path, ".factory", "plan.md");
}
function saveAgentConfig(world: FactoryWorld): void {
  writeFileSync(world.configPath, JSON.stringify({
    ...world.agentConfig, callLog: world.callLog,
    promptsDir: join(world.workspace, "prompts")
  }));
}
function commitCount(world: FactoryWorld): number {
  const result = spawnSync("git", ["rev-list", "--count", "HEAD"], { cwd: world.codebase, encoding: "utf8" });
  return result.status === 0 ? Number(result.stdout) : 0;
}
function baseline(world: FactoryWorld): void {
  world.initialCommitCount = commitCount(world);
  world.baselineHead = run(world.codebase, "git", ["rev-parse", "HEAD"]);
}
Given("a copy of the factory", function (this: FactoryWorld) {
  this.makeWorkspace();
  this.repoRoot = join(this.workspace, "codebase");
  this.factoryDir = join(this.repoRoot, "factory");
  this.callerCwd = this.repoRoot;
  this.seedPath = join(this.repoRoot, "seeds", "tetris.md");
  this.callLog = join(this.workspace, "agent-calls.jsonl");
  this.configPath = join(this.workspace, "agent-config.json");
  this.fakeBin = join(this.workspace, "fake-bin");
  this.chosenAgent = join(this.workspace, "chosen-agent");
  mkdirSync(this.factoryDir, { recursive: true });
  mkdirSync(join(this.repoRoot, "bin"));
  mkdirSync(this.fakeBin);
  for (const name of ["factory", "tsconfig.json", "validation-lens.md", "assembly-line.dot"]) {
    copyFileSync(join(source, name), join(this.factoryDir, name));
  }
  cpSync(join(source, "src"), join(this.factoryDir, "src"), { recursive: true });
  // Configurations belong to the factory; neither specs nor steps are copied.
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (entry.isDirectory() && existsSync(join(source, entry.name, "machine.json"))) {
      mkdirSync(join(this.factoryDir, entry.name));
      copyFileSync(join(source, entry.name, "machine.json"), join(this.factoryDir, entry.name, "machine.json"));
    }
  }
  chmodSync(join(this.factoryDir, "factory"), 0o755);
  symlinkSync(join(source, "node_modules"), join(this.factoryDir, "node_modules"));
  symlinkSync("../factory/factory", join(this.repoRoot, "bin", "factory"));
  for (const path of [this.chosenAgent, join(this.fakeBin, "pi")]) {
    copyFileSync(join(source, "features", "machine-double.cjs"), path);
    chmodSync(path, 0o755);
  }
  for (const name of ["planner", "doer", "validator"]) {
    assert.ok(existsSync(join(this.factoryDir, name, "machine.json")), `Missing packaged configuration for ${name}`);
    machineConfig(this, name, { harness: this.chosenAgent });
  }
  machineConfig(this, "validator", { lensFile: "../validation-lens.md" });
  writeFileSync(join(this.repoRoot, ".gitignore"), "factory/node_modules/\n");
  run(this.repoRoot, "git", ["init", "-q"]);
  run(this.repoRoot, "git", ["add", "."]);
  run(this.repoRoot, "git", ["commit", "-qm", "Factory fixture baseline"]);
});
Given("a new target", function (this: FactoryWorld) {
  selectTarget(this, join(this.repoRoot, "output"));
  mkdirSync(this.codebase, { recursive: true });
  baseline(this);
});
Given("this assembly line:", function (this: FactoryWorld, line: string) {
  writeFileSync(join(this.factoryDir, "assembly-line.dot"), line + "\n");
});
function runFactory(world: FactoryWorld, checkLine = false): void {
  if (!Object.keys(world.unrelatedSnapshot).length) world.unrelatedSnapshot = factorySnapshot(world);
  const earlierCalls = calls(world).length;
  saveAgentConfig(world);
  const args: string[] = checkLine ? ["--check-line"] : ["--attempts", String(world.attempts)];
  if (!checkLine && !world.omitSeed) args.push("--seed", relative(world.callerCwd, world.seedPath));
  if (!world.omitTarget) args.push("--target", world.absoluteTarget ? world.codebase : relative(world.callerCwd, world.codebase) || ".");
  const result = spawnSync(relative(world.callerCwd, join(world.repoRoot, "bin", "factory")), args, {
    cwd: world.callerCwd, encoding: "utf8",
    env: { ...process.env, ...identity, FACTORY_TEST_CONFIG: world.configPath,
      // Typecheck separately; avoid typechecking the copied source on every CLI run.
      TS_NODE_TRANSPILE_ONLY: "true",
      PATH: `${world.fakeBin}${delimiter}${process.env.PATH ?? ""}` },
    timeout: 15_000
  });
  assert.ifError(result.error);
  world.exitCode = result.status;
  world.output = `${result.stdout}${result.stderr}`;
  for (const call of calls(world).slice(earlierCalls)) {
    assert.equal(call.cwd, world.codebase, "Machines must run in the selected target");
  }
}
When("the factory reads the assembly line", function (this: FactoryWorld) { runFactory(this, true); });
Then("it accepts it", function (this: FactoryWorld) {
  assert.equal(this.exitCode, 0, this.output);
  assert.equal(calls(this).length, 0, "Line checking must not call machines");
});
Then("it refuses it", function (this: FactoryWorld) {
  assert.equal(this.exitCode, 1, this.output);
  assert.equal(calls(this).length, 0);
});

function editLine(world: FactoryWorld, change: (line: string) => string): void {
  const path = join(world.factoryDir, "assembly-line.dot");
  writeFileSync(path, change(readFileSync(path, "utf8")));
}
Given("the validator has been taken out, so the doer goes straight to the planner", function (this: FactoryWorld) {
  editLine(this, line => line.replace(/doer\s*->\s*validator/g, "doer -> planner")
    .replace(/^\s*validator\s*->[^\n]*\n/gm, ""));
});
Given("{string} is misspelt {string} throughout the assembly line", function (this: FactoryWorld, before: string, after: string) {
  editLine(this, line => line.replaceAll(before, after));
});
Given("the edge from validator to planner has been taken out", function (this: FactoryWorld) {
  editLine(this, line => line.replace(/^\s*validator\s*->\s*planner[^\n]*\n/gm, ""));
});
Given("the edges from validator are labelled {string} and {string}", function (this: FactoryWorld, positive: string, negative: string) {
  editLine(this, line => line.replace('label="not satisfied"', `label="${negative}"`)
    .replace('label="satisfied"', `label="${positive}"`));
});
Then("it reports that it has no machine called {string}", function (this: FactoryWorld, name: string) {
  assert.equal(this.exitCode, 1, this.output);
  assert.match(this.output, new RegExp(`no machine called ["']?${name}["']?`, "i"));
});
Then("it reports that finish cannot be reached from validator", function (this: FactoryWorld) {
  assert.equal(this.exitCode, 1, this.output);
  assert.match(this.output, /finish cannot be reached from ["']?validator/i);
});
Then("it reports that the result of validator has no field {string}", function (this: FactoryWorld, field: string) {
  assert.equal(this.exitCode, 1, this.output);
  assert.ok(this.output.includes(`The result of validator has no field "${field}"`), this.output);
});

function successful(world: FactoryWorld): void {
  assert.equal(world.exitCode, 0, world.output);
}
function writePlan(world: FactoryWorld, completed: number, tasks = ["alpha", "beta", "gamma"]): void {
  mkdirSync(dirname(world.planPath), { recursive: true });
  writeFileSync(world.planPath, `# Plan\n\n${tasks.map((task, index) => `- [${index < completed ? "x" : " "}] ${task}`).join("\n")}\n`);
  // Existing plans are history, not incidental uncommitted fixture work.
  run(world.codebase, "git", ["add", "--", ".factory/plan.md"]);
  run(world.codebase, "git", ["commit", "--only", "-qm", "Existing target plan", "--", ".factory/plan.md"]);
  baseline(world);
}
function tree(directory: string): Record<string, string> {
  const files: Record<string, string> = {};
  if (!existsSync(directory)) return files;
  const visit = (path: string): void => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if ([".git", "node_modules"].includes(entry.name)) continue;
      const child = join(path, entry.name);
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile()) files[relative(directory, child)] = readFileSync(child).toString("base64");
    }
  };
  visit(directory);
  return files;
}
function factorySnapshot(world: FactoryWorld): Record<string, string> {
  return {
    files: JSON.stringify(tree(world.factoryDir)),
    unrelated: existsSync(join(world.repoRoot, "unrelated.txt")) ? readFileSync(join(world.repoRoot, "unrelated.txt"), "utf8") : "",
    staged: run(world.repoRoot, "git", ["diff", "--cached", "--binary", "--", "factory", "unrelated.txt"]),
    unstaged: run(world.repoRoot, "git", ["diff", "--binary", "--", "factory", "unrelated.txt"]),
    status: run(world.repoRoot, "git", ["status", "--porcelain", "--", "factory", "unrelated.txt"])
  };
}
function targetPrefix(world: FactoryWorld): string {
  const root = run(world.codebase, "git", ["rev-parse", "--show-toplevel"]);
  const prefix = relative(root, world.codebase);
  return prefix ? prefix + "/" : "";
}
function newCommits(world: FactoryWorld): { hash: string; files: string[]; work: string[] }[] {
  if (!commitCount(world)) return [];
  const prefix = targetPrefix(world);
  return run(world.codebase, "git", ["rev-list", "--reverse", world.baselineHead ? `${world.baselineHead}..HEAD` : "HEAD"])
    .split("\n").filter(Boolean).map(hash => {
      const paths = run(world.codebase, "git", ["diff-tree", "--root", "--no-commit-id", "--name-only", "-r", hash]).split("\n").filter(Boolean);
      assert.ok(paths.every(path => path.startsWith(prefix)), `Commit ${hash} included work outside the target: ${paths}`);
      const files = paths.map(path => path.slice(prefix.length));
      return { hash, files, work: files.filter(path => path !== ".factory/plan.md") };
    });
}
function workCommits(world: FactoryWorld) { return newCommits(world).filter(commit => commit.work.length); }
function assertWorkCount(world: FactoryWorld, count: number): void {
  successful(world);
  assert.equal(workCommits(world).length, count, world.output);
  const records = calls(world).filter(call => call.cwd === world.codebase);
  assert.equal(records[0]?.machine, "planner", "The planner must check the plan before work");
  for (let index = 0; index < records.length; index++) {
    const record = records[index];
    if (record.machine !== "planner" || !record.prompt.includes("The task's work has been committed")) continue;
    const previous = records.slice(0, index).reverse().find(call => call.machine === "doer");
    assert.ok(previous, "No work preceded the planner's committed-work notification");
    assert.equal(record.commits, previous.commits + 1, "Commit work before marking its task done");
    const task = previous.plan.match(/^- \[ \] (.+)$/m)?.[1];
    if (task) assert.ok(record.plan.includes(`- [ ] ${task}`), "Doer must not mark the parent task done");
  }
  assert.equal(records.filter(call => call.machine === "planner" && call.prompt.includes("The task's work has been committed")).length, count);
}

Given("a seed describing a game of Tetris", function (this: FactoryWorld) {
  mkdirSync(dirname(this.seedPath), { recursive: true });
  writeFileSync(this.seedPath, "Build a terminal game of Tetris.\n");
  run(this.repoRoot, "git", ["add", "--", "seeds/tetris.md"]);
  run(this.repoRoot, "git", ["commit", "--only", "-qm", "Seed fixture", "--", "seeds/tetris.md"]);
  baseline(this);
});
Given("the planner plans the tasks alpha and beta", function (this: FactoryWorld) { this.agentConfig.tasks = ["alpha", "beta"]; });
Given("the doer does the next task in the plan", function (this: FactoryWorld) { this.agentConfig.doerNoChanges = false; });
Given("the validator is always satisfied", function (this: FactoryWorld) { this.agentConfig.validation = "always"; });
Given("no harness is chosen for the validator", function (this: FactoryWorld) { machineConfig(this, "validator", { harness: undefined }); });
Given("the doer cannot be run", function (this: FactoryWorld) { machineConfig(this, "doer", { harness: join(this.workspace, "missing-doer") }); });
Given("no plan", function (this: FactoryWorld) { rmSync(this.planPath, { force: true }); });
Given("a plan with three tasks, none of them done", function (this: FactoryWorld) { writePlan(this, 0); });
Given("a plan with one pending task", function (this: FactoryWorld) { writePlan(this, 0, ["alpha"]); });
Given("a plan in which every task is done", function (this: FactoryWorld) { writePlan(this, 3); });
Given("a plan whose first task is done", function (this: FactoryWorld) {
  writePlan(this, 1);
  writeFileSync(join(this.codebase, "work-alpha.txt"), "alpha\n");
  run(this.codebase, "git", ["add", "--", "work-alpha.txt"]);
  run(this.codebase, "git", ["commit", "--only", "-qm", "Earlier task work", "--", "work-alpha.txt"]);
  baseline(this);
});
Given("the validator says {string} before its result", function (this: FactoryWorld, message: string) { this.agentConfig.validatorPrefix = message; });
Given("the validator answers in prose, with no result", function (this: FactoryWorld) { this.agentConfig.validatorInProse = true; });
Given("the planner keeps its plan in prose", function (this: FactoryWorld) { this.agentConfig.plannerInProse = true; });
Given("the doer keeps its plan in prose", function (this: FactoryWorld) { this.agentConfig.doerInProse = true; });
Given("the factory allows at most three attempts at a task", function (this: FactoryWorld) { this.attempts = 3; });
Given("the validator is never satisfied", function (this: FactoryWorld) { this.agentConfig.validation = "never"; });
Given("the validator is not satisfied the first time", function (this: FactoryWorld) { this.agentConfig.validation = "reject-first"; });
Given("the validator's lens is testability", function (this: FactoryWorld) { machineConfig(this, "validator", { lens: "testability", lensFile: undefined }); });
Given("no seed is chosen", function (this: FactoryWorld) { this.omitSeed = true; });
Given("the seed has been deleted", function (this: FactoryWorld) { rmSync(this.seedPath); });
Given("no target is chosen", function (this: FactoryWorld) { this.omitTarget = true; });
Given("the target folder does not exist", function (this: FactoryWorld) { rmSync(this.codebase, { recursive: true, force: true }); });
Given("the target is outside any Git repository", function (this: FactoryWorld) {
  selectTarget(this, join(this.workspace, "standalone"));
  mkdirSync(this.codebase);
  assert.notEqual(spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: this.codebase }).status, 0);
  this.baselineHead = "";
  this.initialCommitCount = 0;
});
Given("the factory has staged and unstaged changes", function (this: FactoryWorld) {
  const path = join(this.factoryDir, "src", "fixture-note.txt");
  writeFileSync(path, "staged factory change\n");
  writeFileSync(join(this.repoRoot, "unrelated.txt"), "staged unrelated change\n");
  run(this.repoRoot, "git", ["add", "--", "factory/src/fixture-note.txt", "unrelated.txt"]);
  writeFileSync(path, "unstaged factory change\n");
  writeFileSync(join(this.repoRoot, "unrelated.txt"), "unstaged unrelated change\n");
});

When("the factory runs", function (this: FactoryWorld) { runFactory(this); });
Then("pi has been called", function (this: FactoryWorld) {
  successful(this);
  assert.ok(calls(this, "validator").some(call => call.harness === "pi"), this.output);
});
Then("the doer's chosen harness has been called", function (this: FactoryWorld) {
  successful(this);
  assert.ok(calls(this, "doer").some(call => call.harness === "chosen"), this.output);
});
Then("it reports that it could not run the doer", function (this: FactoryWorld) {
  assert.equal(this.exitCode, 1, this.output);
  assert.match(this.output, /could not run the doer/i);
});
Then("there are no new commits", function (this: FactoryWorld) {
  assert.equal(commitCount(this), this.initialCommitCount, this.output);
});
Then("there is no plan", function (this: FactoryWorld) { assert.equal(existsSync(this.planPath), false); });
Then("the plan has the tasks {string} and {string}, and no others", function (this: FactoryWorld, first: string, second: string) {
  successful(this);
  assert.deepEqual([...readFileSync(this.planPath, "utf8").matchAll(/^- \[[ x]\] (.+)$/gm)].map(match => match[1]), [first, second]);
});
Then("there are three new work commits", function (this: FactoryWorld) { assertWorkCount(this, 3); });
Then("there are two new work commits", function (this: FactoryWorld) { assertWorkCount(this, 2); });
Then("there is one new work commit", function (this: FactoryWorld) { assertWorkCount(this, 1); });
Then("each new work commit contains the work for one task", function (this: FactoryWorld) {
  successful(this);
  assert.deepEqual(workCommits(this).map(commit => commit.work), [["work-alpha.txt"], ["work-beta.txt"], ["work-gamma.txt"]]);
  for (const commit of workCommits(this)) {
    const file = commit.work[0];
    const expected = file.slice("work-".length, -".txt".length);
    assert.match(run(this.codebase, "git", ["show", `${commit.hash}:${targetPrefix(this)}${file}`]), new RegExp(`^${expected}(?:\n|$)`));
  }
});
Then("no new commit contains the work for the first task", function (this: FactoryWorld) {
  successful(this);
  assert.ok(newCommits(this).every(commit => !commit.files.includes("work-alpha.txt")));
  assert.ok(calls(this, "doer").every(call => !call.plan.match(/^- \[ \] alpha$/m)));
});
Then("the doer was pointed at the plan and at the seed", function (this: FactoryWorld) {
  successful(this);
  assert.ok(calls(this, "doer").length);
  for (const call of calls(this, "doer")) {
    assert.ok(call.prompt.includes(this.planPath), "Missing resolved plan path");
    assert.ok(call.prompt.includes(this.seedPath), "Missing resolved seed path");
    assert.equal(call.cwd, this.codebase);
  }
});
Then("the planner was asked for a result with the field {string}", function (this: FactoryWorld, field: string) {
  successful(this);
  assert.ok(calls(this, "planner").length);
  for (const call of calls(this, "planner")) assert.match(call.prompt, new RegExp(`result[\\s\\S]*${field}`, "i"));
});
Then("the validator was asked for a result with the fields {string} and {string}", function (this: FactoryWorld, first: string, second: string) {
  assert.ok(calls(this, "validator").length, this.output);
  for (const call of calls(this, "validator")) {
    assert.match(call.prompt, new RegExp(`result[\\s\\S]*${first}`, "i"));
    assert.match(call.prompt, new RegExp(`result[\\s\\S]*${second}`, "i"));
  }
});
Then("the doer has been called three times", function (this: FactoryWorld) { assert.equal(calls(this, "doer").length, 3, this.output); });
Then("the doer has been called four times", function (this: FactoryWorld) {
  successful(this);
  assert.equal(calls(this, "doer").length, 4, this.output);
  assert.deepEqual(calls(this).map(call => call.machine), ["planner", "doer", "validator", "doer", "validator", "planner", "doer", "validator", "planner", "doer", "validator", "planner"]);
});
Then("the doer has not been called", function (this: FactoryWorld) {
  successful(this);
  assert.equal(calls(this, "doer").length, 0, this.output);
});
Then("the validator has not been called", function (this: FactoryWorld) {
  successful(this);
  assert.equal(calls(this, "validator").length, 0, this.output);
  assert.deepEqual(calls(this).map(call => call.machine), ["planner", "doer", "planner", "doer", "planner", "doer", "planner"]);
  assertWorkCount(this, 3);
});
Then("the factory has stopped", function (this: FactoryWorld) { assert.notEqual(this.exitCode, null); });
Then("it reports that a task hit its limit", function (this: FactoryWorld) {
  assert.equal(this.exitCode, 1, this.output);
  assert.match(this.output, /task hit its limit/i);
  assert.equal(readFileSync(join(this.codebase, "work-alpha.txt"), "utf8"), "alpha\ncorrected\n");
  assert.deepEqual(calls(this).map(call => call.machine), ["planner", "doer", "validator", "doer", "validator", "doer", "validator"]);
});
Then("the plan shows every task as done", function (this: FactoryWorld) {
  successful(this);
  const plan = readFileSync(this.planPath, "utf8");
  assert.equal(/^- \[ \]/m.test(plan), false);
  assert.ok((plan.match(/^- \[x\]/gm) ?? []).length > 0);
});
Then("the plan shows every task as not done", function (this: FactoryWorld) {
  const plan = readFileSync(this.planPath, "utf8");
  assert.ok((plan.match(/^- \[ \]/gm) ?? []).length > 0);
  assert.equal(/^- \[x\]/m.test(plan), false);
});
Then("it reports that it could not read the validator's result", function (this: FactoryWorld) {
  assert.equal(this.exitCode, 1, this.output);
  assert.match(this.output, /could not read the validator's result/i);
});
Then("it reports that there is no seed", function (this: FactoryWorld) {
  assert.equal(this.exitCode, 1, this.output);
  assert.match(this.output, /there is no seed/i);
});
Then("it reports that a target is required", function (this: FactoryWorld) {
  assert.equal(this.exitCode, 1, this.output);
  assert.match(this.output, /a target is required/i);
});
Then("no agent has been called", function (this: FactoryWorld) { assert.equal(calls(this).length, 0); });
Then("the planner was called before the doer", function (this: FactoryWorld) {
  successful(this);
  const records = calls(this);
  assert.equal(records[0]?.machine, "planner");
  const firstDoer = records.find(call => call.machine === "doer");
  assert.ok(firstDoer);
  assert.equal(records[0].plan, "");
  assert.match(firstDoer.plan, /- \[ \] alpha/);
});
Then("the plan still has those three tasks", function (this: FactoryWorld) {
  successful(this);
  assert.deepEqual([...readFileSync(this.planPath, "utf8").matchAll(/^- \[[ x]\] (.+)$/gm)].map(match => match[1]), ["alpha", "beta", "gamma"]);
});
Then(/^the plan is \.factory\/plan\.md in the target$/,  function (this: FactoryWorld) {
  successful(this);
  assert.equal(this.planPath, join(this.codebase, ".factory", "plan.md"));
  assert.equal(existsSync(this.planPath), true);
  assert.equal(existsSync(join(this.codebase, "factory")), false, "Target must not contain factory source");
  assert.ok(calls(this).length);
  assert.ok(calls(this).every(call => call.cwd === this.codebase));
});
Then("there is no plan in the factory's folder", function (this: FactoryWorld) {
  assert.equal(existsSync(join(this.factoryDir, "plan.md")), false);
  assert.equal(existsSync(join(this.factoryDir, ".factory", "plan.md")), false);
});
Then("the work for alpha and beta has been committed", function (this: FactoryWorld) {
  assertWorkCount(this, 2);
  assert.equal(run(this.codebase, "git", ["show", `HEAD:${targetPrefix(this)}work-alpha.txt`]), "alpha");
  assert.equal(run(this.codebase, "git", ["show", `HEAD:${targetPrefix(this)}work-beta.txt`]), "beta");
  assert.match(readFileSync(this.planPath, "utf8"), /Alpha is done\.[\s\S]*Beta is done\./);
});
Then("the committed plan matches the plan on disk", function (this: FactoryWorld) {
  successful(this);
  const committed = spawnSync("git", ["show", `HEAD:${targetPrefix(this)}.factory/plan.md`], { cwd: this.codebase, encoding: "utf8" });
  assert.equal(committed.status, 0, committed.stderr);
  assert.equal(committed.stdout, readFileSync(this.planPath, "utf8"));
});
Then("the target has no uncommitted changes", function (this: FactoryWorld) {
  successful(this);
  assert.equal(run(this.codebase, "git", ["status", "--porcelain", "--", "."]), "");
});
Then("the validator was given the work for the second task", function (this: FactoryWorld) {
  successful(this);
  const validator = calls(this, "validator")[0];
  assert.ok(validator, this.output);
  assert.match(validator.prompt, /Changed work:/);
  assert.match(validator.prompt, /work-beta\.txt/);
  assert.match(validator.prompt, /\+beta/);
});
Then("it was not given the work for the first task", function (this: FactoryWorld) {
  for (const call of calls(this, "validator")) assert.doesNotMatch(call.prompt.split("Changed work:")[1] ?? call.prompt, /work-alpha\.txt|\+alpha/);
});
Then("the validator was given {string}", function (this: FactoryWorld, lens: string) {
  successful(this);
  assert.ok(calls(this, "validator").length);
  for (const call of calls(this, "validator")) assert.ok(call.prompt.includes(lens), `Missing lens: ${lens}`);
});
Then("the doer was given the validator's findings", function (this: FactoryWorld) {
  successful(this);
  const record = calls(this, "doer")[1];
  assert.ok(record);
  const findings = JSON.parse(record.prompt.match(/Validator findings:\n([^\n]+)/)?.[1] ?? "null");
  assert.deepEqual(findings, [{ file: "work-alpha.txt", issue: "Give the behavior a focused collaborator" }]);
  assert.match(record.prompt, /subtask/i);
  assert.match(readFileSync(this.planPath, "utf8"), /- \[x\] alpha\n  - \[x\] Give the behavior a focused collaborator/);
  assert.equal(readFileSync(join(this.codebase, "work-alpha.txt"), "utf8"), "alpha\ncorrected\n");
  const afterCorrection = calls(this, "validator")[1];
  assert.match(afterCorrection.plan, /- \[ \] alpha\n  - \[x\] Give the behavior a focused collaborator/);
  assert.equal(afterCorrection.commits, this.initialCommitCount, "Retry must not create a commit");
});
Then("the target uses the containing repository", function (this: FactoryWorld) {
  successful(this);
  assert.equal(existsSync(join(this.codebase, ".git")), false);
  assert.equal(run(this.codebase, "git", ["rev-parse", "--show-toplevel"]), this.repoRoot);
});
Then("the target is a Git repository", function (this: FactoryWorld) {
  successful(this);
  assert.equal(existsSync(join(this.codebase, ".git")), true);
  assert.equal(run(this.codebase, "git", ["rev-parse", "--show-toplevel"]), this.codebase);
  assertWorkCount(this, 2);
});
Then("the factory's own files and unrelated uncommitted changes are as they were", function (this: FactoryWorld) {
  assert.deepEqual(factorySnapshot(this), this.unrelatedSnapshot);
});

function buildNamedTarget(world: FactoryWorld, name: string, absolute = false): void {
  selectTarget(world, join(world.repoRoot, name));
  mkdirSync(world.codebase, { recursive: true });
  baseline(world);
  world.absoluteTarget = absolute;
  runFactory(world);
  successful(world);
  if (!(name in world.targetSnapshots)) world.targetSnapshots[name] = tree(world.codebase);
}
When("the factory builds the target {string} to completion", function (this: FactoryWorld, name: string) { buildNamedTarget(this, name); });
When("the factory builds the same target using its absolute path", function (this: FactoryWorld) {
  buildNamedTarget(this, relative(this.repoRoot, this.codebase), true);
});
Then("the target {string} is unchanged", function (this: FactoryWorld, name: string) {
  assert.ok(name in this.targetSnapshots);
  const target = join(this.repoRoot, name);
  assert.deepEqual(tree(target), this.targetSnapshots[name]);
  assert.equal(run(target, "git", ["status", "--porcelain", "--", "."]), "");
});
Then("the targets {string} and {string} each have their own completed plan and committed work", function (this: FactoryWorld, first: string, second: string) {
  for (const name of [first, second]) {
    const target = join(this.repoRoot, name);
    const plan = readFileSync(join(target, ".factory", "plan.md"), "utf8");
    assert.match(plan, /- \[x\] alpha\n- \[x\] beta/);
    assert.doesNotMatch(plan, /- \[ \]/);
    for (const file of [".factory/plan.md", "work-alpha.txt", "work-beta.txt"]) {
      const committed = spawnSync("git", ["show", `HEAD:${name}/${file}`], { cwd: this.repoRoot, encoding: "utf8" });
      assert.equal(committed.status, 0, committed.stderr);
      assert.equal(committed.stdout, readFileSync(join(target, file), "utf8"));
    }
    const records = calls(this).filter(call => call.cwd === target);
    assert.equal(records[0]?.plan, "", "Fresh targets must not inherit another plan");
    assert.equal(records.filter(call => call.machine === "doer").length, 2);
    assert.equal(run(target, "git", ["status", "--porcelain", "--", "."]), "");
  }
  assert.notEqual(join(this.repoRoot, first), join(this.repoRoot, second));
});

Given("Git rejects the commit", function (this: FactoryWorld) {
  const hook = join(this.repoRoot, ".git", "hooks", "pre-commit");
  writeFileSync(hook, '#!/bin/sh\necho "simulated commit failure" >&2\nexit 1\n');
  chmodSync(hook, 0o755);
});
Then("it reports the Git commit failure", function (this: FactoryWorld) {
  assert.equal(this.exitCode, 1, this.output);
  assert.match(this.output, /simulated commit failure/);
});
Then("the planner has not been asked to record committed work", function (this: FactoryWorld) {
  assert.ok(calls(this, "planner").every(call => !call.prompt.includes("The task's work has been committed")));
});
Given("a separate target with an unrelated staged change beside it", function (this: FactoryWorld) {
  selectTarget(this, join(this.repoRoot, "nested", "target"));
  mkdirSync(this.codebase, { recursive: true });
  writeFileSync(join(this.repoRoot, "unrelated.txt"), "student's unrelated change\n");
  run(this.repoRoot, "git", ["add", "--", "unrelated.txt"]);
});
Then("the unrelated change remains staged and uncommitted", function (this: FactoryWorld) {
  assert.equal(run(this.repoRoot, "git", ["diff", "--cached", "--name-only"]), "unrelated.txt");
  assert.equal(run(this.repoRoot, "git", ["show", ":unrelated.txt"]), "student's unrelated change");
  assert.notEqual(spawnSync("git", ["cat-file", "-e", "HEAD:unrelated.txt"], { cwd: this.repoRoot }).status, 0);
  newCommits(this); // Every new commit, not just HEAD, must be target-scoped.
});
Given("the validator follows its verdict with JSON that has no verdict fields", function (this: FactoryWorld) { this.agentConfig.invalidLastVerdict = true; });
Given("the next task edits an existing tracked file", function (this: FactoryWorld) {
  writeFileSync(join(this.codebase, "work-alpha.txt"), "before the task\n");
  run(this.codebase, "git", ["add", "--", "work-alpha.txt"]);
  run(this.codebase, "git", ["commit", "--only", "-qm", "Existing task file", "--", "work-alpha.txt"]);
  baseline(this);
});
Then("the tracked task file's change is committed", function (this: FactoryWorld) {
  successful(this);
  assert.equal(run(this.codebase, "git", ["show", `HEAD:${targetPrefix(this)}work-alpha.txt`]), "alpha");
  assert.ok(workCommits(this).some(commit => commit.work.includes("work-alpha.txt")));
  assert.equal(run(this.codebase, "git", ["status", "--porcelain", "--", "work-alpha.txt"]), "");
});
Given("the doer renames the existing tracked task file", function (this: FactoryWorld) { this.agentConfig.doerRename = true; });
Then("the renamed task file is committed without the original path", function (this: FactoryWorld) {
  successful(this);
  const prefix = targetPrefix(this);
  assert.equal(run(this.codebase, "git", ["show", `HEAD:${prefix}work-alpha-renamed.txt`]), "alpha");
  assert.notEqual(spawnSync("git", ["cat-file", "-e", `HEAD:${prefix}work-alpha.txt`], { cwd: this.codebase }).status, 0);
  assert.equal(existsSync(join(this.codebase, "work-alpha.txt")), false);
  assert.equal(readFileSync(join(this.codebase, "work-alpha-renamed.txt"), "utf8"), "alpha\n");
});
Given("the doer produces no file changes", function (this: FactoryWorld) { this.agentConfig.doerNoChanges = true; });
Given("the next task generates a large lockfile", function (this: FactoryWorld) {
  this.agentConfig.largeLockfile = JSON.stringify({
    name: "large-prompt-fixture",
    packages: Array.from({ length: 8000 }, (_, index) => ({ name: `package-${index}`, version: "1.0.0", description: "Unicode café and spaces survive transport" }))
  }, null, 2) + "\n";
  assert.ok(Buffer.byteLength(this.agentConfig.largeLockfile) > 1024 * 1024);
});
Then("the validator receives the entire lockfile diff through stdin", function (this: FactoryWorld) {
  successful(this);
  const validators = calls(this, "validator");
  assert.equal(validators.length, 1);
  const addedLines = this.agentConfig.largeLockfile!.trimEnd().split("\n").map(line => `+${line}`).join("\n");
  assert.ok(validators[0].prompt.includes(addedLines), "Validator input must contain the full lockfile diff");
  for (const call of calls(this)) assert.deepEqual(call.args, ["-p"], "Prompts must not travel in command arguments");
});
Then("it reports that there is no committable work", function (this: FactoryWorld) {
  assert.equal(this.exitCode, 1, this.output);
  assert.match(this.output, /no committable work/i);
});
Given("the validator explicitly answers with the field {string}", function (this: FactoryWorld, field: string) { this.agentConfig.validatorField = field; });
Given("the caller is in a different folder", function (this: FactoryWorld) {
  this.callerCwd = join(this.repoRoot, "caller", "nested");
  mkdirSync(this.callerCwd, { recursive: true });
});
Then("the public entrypoint is the symlink to the separate factory", function (this: FactoryWorld) {
  const { readlinkSync } = require("node:fs") as typeof import("node:fs");
  assert.equal(readlinkSync(join(this.repoRoot, "bin", "factory")), "../factory/factory");
  assert.equal(existsSync(join(this.factoryDir, "features")), false);
  assert.equal(existsSync(join(this.factoryDir, "spec")), false);
});
