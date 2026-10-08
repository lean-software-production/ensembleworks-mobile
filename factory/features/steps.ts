import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import {
  chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync,
  readdirSync, rmSync, symlinkSync, writeFileSync
} from "node:fs";
import { basename, delimiter, dirname, join, relative, resolve } from "node:path";
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
  const path = join(world.codebase, ".assembly-lines", ".machines", name, "machine.json");
  const config = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { role: name };
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) delete config[key];
    else config[key] = value;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n");
}
// Lines and machines travel with the target; runs that build it follow.
function moveTarget(world: FactoryWorld, path: string): void {
  const from = world.codebase;
  mkdirSync(path, { recursive: true });
  cpSync(join(from, ".assembly-lines"), join(path, ".assembly-lines"), { recursive: true });
  rmSync(from, { recursive: true, force: true });
  for (const fixture of Object.values(world.runs)) if (fixture.target === from) fixture.target = path;
  world.targets = world.targets.map(target => target === from ? path : target);
  world.codebase = path;
}
function saveAgentConfig(world: FactoryWorld, planPath = ""): void {
  writeFileSync(world.configPath, JSON.stringify({
    ...world.agentConfig, callLog: world.callLog, planPath,
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
  // Only the factory's source is copied: lines and machines belong to targets.
  for (const name of ["factory", "tsconfig.json"]) {
    copyFileSync(join(source, name), join(this.factoryDir, name));
  }
  cpSync(join(source, "src"), join(this.factoryDir, "src"), { recursive: true });
  chmodSync(join(this.factoryDir, "factory"), 0o755);
  symlinkSync(join(source, "node_modules"), join(this.factoryDir, "node_modules"));
  symlinkSync("../factory/factory", join(this.repoRoot, "bin", "factory"));
  for (const path of [this.chosenAgent, join(this.fakeBin, "pi")]) {
    copyFileSync(join(source, "features", "machine-double.cjs"), path);
    chmodSync(path, 0o755);
  }
  writeFileSync(join(this.repoRoot, ".gitignore"), "factory/node_modules/\nfactory/runs/\n");
  run(this.repoRoot, "git", ["init", "-q"]);
  run(this.repoRoot, "git", ["add", "."]);
  run(this.repoRoot, "git", ["commit", "-qm", "Factory fixture baseline"]);
});
Given("a new target, with a seed describing a game of {word}", function (this: FactoryWorld, game: string) {
  const name = game.toLowerCase();
  this.seedPath = join(this.repoRoot, "seeds", `${name}.md`);
  if (!existsSync(this.seedPath)) {
    mkdirSync(dirname(this.seedPath), { recursive: true });
    writeFileSync(this.seedPath, `Build a terminal game of ${game}.\n`);
    run(this.repoRoot, "git", ["add", "--", `seeds/${name}.md`]);
    run(this.repoRoot, "git", ["commit", "--only", "-qm", "Seed fixture", "--", `seeds/${name}.md`]);
  }
  this.codebase = join(this.repoRoot, "targets", `${name}-${this.targets.length + 1}`);
  this.targets.push(this.codebase);
  mkdirSync(this.codebase, { recursive: true });
  baseline(this);
});
Given("the target has the machines planner, doer and validator", function (this: FactoryWorld) {
  for (const name of ["planner", "doer", "validator"]) machineConfig(this, name, { harness: this.chosenAgent });
});
const validatedLine = `digraph assembly_line {
  start -> planner
  planner -> doer        [label="not complete"]
  planner -> finish      [label="complete"]
  doer -> validator
  validator -> doer      [label="not satisfied"]
  validator -> planner   [label="satisfied"]
}
`;
const uncheckedLine = `digraph assembly_line {
  start -> planner
  planner -> doer        [label="not complete"]
  planner -> finish      [label="complete"]
  doer -> planner
}
`;
function linePath(target: string, name: string): string { return join(target, ".assembly-lines", `${name}.dot`); }
function writeLine(world: FactoryWorld, name: string, line: string): void {
  mkdirSync(join(world.codebase, ".assembly-lines"), { recursive: true });
  writeFileSync(linePath(world.codebase, name), line);
}
Given("the target has an assembly line {string} on which the doer's work is validated", function (this: FactoryWorld, name: string) {
  writeLine(this, name, validatedLine);
});
Given("the target has an assembly line {string} on which the doer goes straight to the planner", function (this: FactoryWorld, name: string) {
  writeLine(this, name, uncheckedLine);
});
Given("the {string} line has been copied into the target", function (this: FactoryWorld, name: string) {
  const from = this.targets.find(target => existsSync(linePath(target, name)));
  assert.ok(from, `No target holds a "${name}" line to copy`);
  mkdirSync(join(this.codebase, ".assembly-lines"), { recursive: true });
  copyFileSync(linePath(from, name), linePath(this.codebase, name));
});
Given("this assembly line:", function (this: FactoryWorld, line: string) {
  this.lineName = "assembly-line";
  writeLine(this, this.lineName, line + "\n");
});
Given("a run named {string}, on the {string} line, with that seed and target", function (this: FactoryWorld, name: string, line: string) {
  this.runs[name] = { target: this.codebase, seed: this.seedPath, line, plan: join(this.factoryDir, "runs", name, "plan.md") };
  this.planPath = this.runs[name].plan;
});
function invoke(world: FactoryWorld, args: string[]): void {
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
}
// A run is given its settings, its name alone, or its name and whichever target is current.
function runFactory(world: FactoryWorld, name: string, given: "settings" | "name" | "target" = "settings"): void {
  const fixture = world.runs[name];
  const path = (to: string): string => relative(world.callerCwd, to) || ".";
  const args = ["--run", name, "--attempts", String(world.attempts)];
  if (given === "target") args.push("--target", path(world.codebase));
  else {
    world.codebase = fixture.target;
    world.planPath = fixture.plan;
    world.seedPath = fixture.seed;
  }
  if (given === "settings") {
    args.push("--line", fixture.line, "--seed", path(fixture.seed));
    if (!world.omitTarget) args.push("--target", path(fixture.target));
  }
  if (!Object.keys(world.unrelatedSnapshot).length) world.unrelatedSnapshot = factorySnapshot(world);
  const earlierCalls = calls(world).length;
  saveAgentConfig(world, fixture.plan);
  invoke(world, args);
  const made = calls(world).slice(earlierCalls);
  world.lastCalls = made.length;
  world.runCalls[name] = [...(world.runCalls[name] ?? []), ...made];
  for (const call of made) assert.equal(call.cwd, fixture.target, "Machines must run in the run's target");
}
function checkLine(world: FactoryWorld): void {
  saveAgentConfig(world);
  invoke(world, ["--check-line", "--line", world.lineName, "--target", relative(world.callerCwd, world.codebase)]);
}
When("the factory reads the assembly line", function (this: FactoryWorld) { checkLine(this); });
Then("it accepts it", function (this: FactoryWorld) {
  assert.equal(this.exitCode, 0, this.output);
  assert.equal(calls(this).length, 0, "Line checking must not call machines");
});
Then("it refuses it", function (this: FactoryWorld) {
  assert.equal(this.exitCode, 1, this.output);
  assert.equal(calls(this).length, 0);
});

function editLine(world: FactoryWorld, change: (line: string) => string, name = world.lineName): void {
  const path = linePath(world.codebase, name);
  writeFileSync(path, change(readFileSync(path, "utf8")));
}
const withoutValidator = (line: string): string => line.replace(/doer\s*->\s*validator/g, "doer -> planner")
  .replace(/^\s*validator\s*->[^\n]*\n/gm, "");
Given("the validator has been taken out, so the doer goes straight to the planner", function (this: FactoryWorld) {
  editLine(this, withoutValidator);
});
Given("the validator has been taken out of the {string} line, so the doer goes straight to the planner", function (this: FactoryWorld, name: string) {
  editLine(this, withoutValidator, name);
});
Given("{string} is misspelt {string} throughout the assembly line", function (this: FactoryWorld, before: string, after: string) {
  editLine(this, line => line.replaceAll(before, after));
});
Given("{string} is misspelt {string} throughout the {string} line", function (this: FactoryWorld, before: string, after: string, name: string) {
  editLine(this, line => line.replaceAll(before, after), name);
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
  baseline(world);
}
function tree(directory: string, skip: string[] = []): Record<string, string> {
  const files: Record<string, string> = {};
  if (!existsSync(directory)) return files;
  const visit = (path: string): void => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if ([".git", "node_modules", ...skip].includes(entry.name)) continue;
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
    // Run state is the runs', not the factory's own files.
    files: JSON.stringify(tree(world.factoryDir, ["runs"])),
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
      assert.ok(files.every(path => !path.startsWith(".assembly-lines/")), `Commit ${hash} included the target's lines: ${files}`);
      return { hash, files, work: files };
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
Given("the validator's lens is kept in a file beside its configuration, saying {string}", function (this: FactoryWorld, lens: string) {
  machineConfig(this, "validator", { lensFile: "lens.md" });
  writeFileSync(join(this.codebase, ".assembly-lines", ".machines", "validator", "lens.md"), lens + "\n");
});
Given("the validator's lens is testability", function (this: FactoryWorld) { machineConfig(this, "validator", { lens: "testability", lensFile: undefined }); });
Given("the seed has been deleted", function (this: FactoryWorld) { rmSync(this.seedPath); });
Given("no target is chosen", function (this: FactoryWorld) { this.omitTarget = true; });
Given("the target is outside any Git repository", function (this: FactoryWorld) {
  moveTarget(this, join(this.workspace, "standalone"));
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

Given("a plan for each run with three tasks of its own, none of them done", function (this: FactoryWorld) {
  const tasks = [["alpha", "beta", "gamma"], ["delta", "epsilon", "zeta"]];
  Object.values(this.runs).forEach((fixture, index) => {
    this.planPath = fixture.plan;
    writePlan(this, 0, tasks[index]);
  });
});
Given("the {string} run has been started", function (this: FactoryWorld, name: string) {
  // A run starts the first time it is invoked. With nothing left to do, that is all it does.
  this.planPath = this.runs[name].plan;
  writePlan(this, 3);
  runFactory(this, name);
  successful(this);
});

When("the factory runs the {string} run", function (this: FactoryWorld, name: string) { runFactory(this, name); });
When("the factory runs the {string} run, given only its name", function (this: FactoryWorld, name: string) { runFactory(this, name, "name"); });
When("the factory runs the {string} run with that target", function (this: FactoryWorld, name: string) { runFactory(this, name, "target"); });
Then("the factory refuses", function (this: FactoryWorld) {
  assert.equal(this.exitCode, 1, this.output);
  assert.equal(this.lastCalls, 0, "A refused run must not call machines");
});
Then("it says the {string} run already has a target", function (this: FactoryWorld, name: string) {
  assert.ok(this.output.includes(`The "${name}" run already has a target`), this.output);
});
Then("the validator was called for the {string} run", function (this: FactoryWorld, name: string) {
  assert.ok(this.runCalls[name]?.some(call => call.machine === "validator"), this.output);
});
Then("the validator was not called for the {string} run", function (this: FactoryWorld, name: string) {
  assert.ok(this.runCalls[name]?.some(call => call.machine === "doer"), this.output);
  assert.ok(this.runCalls[name].every(call => call.machine !== "validator"));
});
Then("the validator has been called twice", function (this: FactoryWorld) {
  successful(this);
  assert.equal(calls(this, "validator").length, 2, this.output);
});
function completedTasks(plan: string): string[] {
  const text = readFileSync(plan, "utf8");
  assert.doesNotMatch(text, /^- \[ \]/m, `Unfinished plan at ${plan}`);
  return [...text.matchAll(/^- \[x\] (.+)$/gm)].map(match => match[1]);
}
Then("each run has its own plan", function (this: FactoryWorld) {
  const plans = Object.entries(this.runs).map(([name, fixture]) => {
    assert.equal(fixture.plan, join(this.factoryDir, "runs", name, "plan.md"));
    assert.ok(completedTasks(fixture.plan).length);
    assert.equal(this.runCalls[name]?.[0]?.plan, "", "A new run must not inherit another run's plan");
    return fixture.plan;
  });
  assert.equal(new Set(plans).size, plans.length);
});
Then("each target holds only its own run's work", function (this: FactoryWorld) {
  for (const [name, fixture] of Object.entries(this.runs)) {
    const work = completedTasks(fixture.plan).map(task => `work-${task}.txt`).sort();
    assert.ok(work.length);
    assert.deepEqual(Object.keys(tree(fixture.target, [".assembly-lines"])).sort(), work);
    assert.ok(this.runCalls[name]?.length);
    assert.ok(this.runCalls[name].every(call => call.cwd === fixture.target));
    assert.equal(run(fixture.target, "git", ["status", "--porcelain", "--", ".", ":(exclude).assembly-lines"]), "");
  }
});
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
Then("the plan is plan.md in the factory's runs folder, under tetris", function (this: FactoryWorld) {
  successful(this);
  assert.equal(this.planPath, join(this.factoryDir, "runs", "tetris", "plan.md"));
  assert.equal(existsSync(this.planPath), true);
  assert.ok(calls(this).length);
});
Then("there is no plan in the target", function (this: FactoryWorld) {
  assert.equal(existsSync(join(this.codebase, ".factory")), false);
  assert.ok(Object.keys(tree(this.codebase)).every(file => basename(file) !== "plan.md"));
});
Then("the work for alpha and beta has been committed", function (this: FactoryWorld) {
  assertWorkCount(this, 2);
  assert.equal(run(this.codebase, "git", ["show", `HEAD:${targetPrefix(this)}work-alpha.txt`]), "alpha");
  assert.equal(run(this.codebase, "git", ["show", `HEAD:${targetPrefix(this)}work-beta.txt`]), "beta");
  // Either way the planner keeps it: as prose or as a checklist.
  assert.match(readFileSync(this.planPath, "utf8"), /Alpha is done\.[\s\S]*Beta is done\.|- \[x\] alpha\n- \[x\] beta/);
});
Then("the target has no uncommitted changes", function (this: FactoryWorld) {
  successful(this);
  assert.equal(run(this.codebase, "git", ["status", "--porcelain", "--", ".", ":(exclude).assembly-lines"]), "");
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
  moveTarget(this, join(this.repoRoot, "nested", "target"));
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
