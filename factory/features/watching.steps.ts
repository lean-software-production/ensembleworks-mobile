import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { delimiter, dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { FactoryWorld } from "./world";
import { calls, identity, invoke, saveAgentConfig, successful } from "./steps";

async function until(check: () => boolean, message: string): Promise<void> {
  const end = Date.now() + 8000;
  while (!check()) {
    assert.ok(Date.now() < end, message);
    await delay(15);
  }
}
function events(world: FactoryWorld, name: string): any[] {
  const file = join(world.factoryDir, "runs", name, "events.jsonl");
  return existsSync(file) ? readFileSync(file, "utf8").split("\n").slice(0, -1).map(line => JSON.parse(line)) : [];
}
function isRunning(world: FactoryWorld, name: string): boolean {
  return events(world, name).filter(event => event.type === "run").at(-1)?.status === "running";
}
function daemonStatus(world: FactoryWorld): { running: boolean; run: string | null } {
  const previous = { output: world.output, exitCode: world.exitCode };
  invoke(world, ["status"]);
  successful(world);
  const status = JSON.parse(world.output);
  Object.assign(world, previous);
  return status;
}
function start(world: FactoryWorld, name: string): void {
  const fixture = world.runs[name];
  saveAgentConfig(world, fixture.plan);
  const previousCalls = calls(world).length;
  invoke(world, ["--run", name, "--target", fixture.target, "--line", fixture.line, "--seed", fixture.seed]);
  world.lastCalls = calls(world).length - previousCalls;
}
function waitingPath(world: FactoryWorld, machine: string): string {
  return join(world.workspace, "prompts", `${machine}.waiting`);
}
async function hold(world: FactoryWorld, name: string, machines: string[], firstLine = "started"): Promise<void> {
  world.agentConfig.holdMachines = machines;
  if (machines.includes("doer")) world.agentConfig.doerLines ??= [firstLine];
  start(world, name);
  successful(world);
  await until(() => machines.every(machine => existsSync(waitingPath(world, machine))), `Machines did not start: ${world.output}`);
  // The fixture is blocked inside session/prompt until explicitly released.
  for (const machine of machines) assert.ok(events(world, name).some(event => event.type === "text" && event.machine === machine));
}
function release(world: FactoryWorld): void {
  for (const machine of world.agentConfig.holdMachines ?? []) {
    writeFileSync(join(dirname(waitingPath(world, machine)), `${machine}.release`), "finish");
  }
  world.agentConfig.holdMachines = [];
}
async function attach(world: FactoryWorld, name: string): Promise<void> {
  world.watched = "";
  world.watchingRun = name;
  const child = spawn(join(world.repoRoot, "bin", "factory"), ["watch", name], {
    cwd: world.repoRoot, env: { ...process.env, TS_NODE_TRANSPILE_ONLY: "true" }
  });
  world.watcher = child;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", text => { world.watched += text; });
  child.stderr.on("data", text => { world.watched += text; });
  await until(() => world.watched.includes(`run ${name} running`), "Watcher did not attach");
  const snapshot = events(world, name);
  const texts = snapshot.filter(event => event.type === "text");
  await until(() => texts.every(event => world.watched.includes(event.text.trim())), "Watcher did not catch up");
}
async function watcherFinished(world: FactoryWorld): Promise<void> {
  if (!world.watcher) return;
  await until(() => world.watcher!.exitCode !== null, "Watcher did not finish");
  assert.equal(world.watcher.exitCode, 0, world.watched);
}

When("I watch the {string} run", async function (this: FactoryWorld, name: string) {
  if (isRunning(this, name)) await attach(this, name);
  else {
    invoke(this, ["watch", name]); successful(this); this.watched = this.output;
  }
});
Given("I am watching the {string} run as it runs", async function (this: FactoryWorld, name: string) {
  await hold(this, name, ["doer"]);
  await attach(this, name);
});
Given("I am watching the {string} run", async function (this: FactoryWorld, name: string) { await attach(this, name); });
When("the {string} run has run to the end", async function (this: FactoryWorld, name: string) {
  release(this);
  await until(() => !isRunning(this, name), "Run did not finish");
  await watcherFinished(this);
  assert.equal(events(this, name).filter(event => event.type === "run").at(-1)?.status, "completed", this.watched);
});
for (const kind of ["doer's tokens", "run's total"]) {
  Then(`what I watched showed the ${kind} go up`, function (this: FactoryWorld) {
    const pattern = kind.startsWith("doer") ? /tokens\s+doer (\d+) in/g : /\srun (\d+)\n/g;
    const values = [...this.watched.matchAll(pattern)].map(match => Number(match[1]));
    assert.ok(values.length >= 2, this.watched);
    assert.ok(values.at(-1)! > values[0], this.watched);
    assert.ok(values.every((value, index) => index === 0 || value >= values[index - 1]));
  });
}
Given("the doer says {string}, then {string}", function (this: FactoryWorld, first: string, second: string) {
  this.agentConfig.doerLines = [first, second];
});
Given("the {string} run is running, with the doer part-way through an attempt, having said {string}",
  async function (this: FactoryWorld, name: string, first: string) { await hold(this, name, ["doer"], first); });
Given("the {string} run is running, with the doer part-way through an attempt",
  async function (this: FactoryWorld, name: string) { await hold(this, name, ["doer"]); });
Given("the {string} run is running, with every reviewer part-way through",
  async function (this: FactoryWorld, name: string) { await hold(this, name, ["reviewer_1", "reviewer_2", "reviewer_3"]); });
Then("I see {string} from the doer", function (this: FactoryWorld, text: string) {
  assert.ok(this.watched.split("\n").some(line => line.startsWith("doer ") && line.includes(text)), this.watched);
});
Then("I do not see {string}", function (this: FactoryWorld, text: string) {
  assert.ok(!this.watched.includes(text), this.watched);
  assert.ok(this.watcher && this.watcher.exitCode === null, "The watcher must still be attached");
});
Then(/^I see "([^"]*)" from reviewer_1, reviewer_2 and reviewer_3$/, function (this: FactoryWorld, text: string) {
  for (const name of ["reviewer_1", "reviewer_2", "reviewer_3"]) {
    assert.ok(this.watched.split("\n").some(line => line.startsWith(name) && line.includes(text)), this.watched);
  }
});
Then("it shows reviewer_1, reviewer_2 and reviewer_3 as running", function (this: FactoryWorld) {
  const current = this.watched.split("\n").filter(line => line.startsWith("running ")).at(-1)!;
  for (const name of ["reviewer_1", "reviewer_2", "reviewer_3"]) assert.ok(current.includes(name), this.watched);
  assert.equal(this.watcher?.exitCode, null);
});
Then("I see what the planner generated", function (this: FactoryWorld) {
  const actual = events(this, this.watchingRun).filter(event => event.type === "text" && event.machine === "planner");
  assert.ok(actual.length);
  for (const event of actual) assert.ok(this.watched.includes(event.text.trim()), this.watched);
});
When("I stop the {string} run", async function (this: FactoryWorld, name: string) {
  invoke(this, ["stop", name]); successful(this);
  assert.equal(isRunning(this, name), false);
  for (const machine of this.agentConfig.holdMachines ?? []) {
    const pid = Number(readFileSync(waitingPath(this, machine), "utf8"));
    assert.throws(() => process.kill(pid, 0), { code: "ESRCH" }, `${machine} is still running`);
  }
  this.agentConfig.holdMachines = [];
  saveAgentConfig(this, this.runs[name].plan);
  await watcherFinished(this);
});
Then("what I am watching shows that the {string} run was stopped", function (this: FactoryWorld, name: string) {
  assert.ok(this.watched.includes(`run ${name} stopped`), this.watched);
});
Given("I have stopped the {string} run", async function (this: FactoryWorld, name: string) {
  invoke(this, ["stop", name]); successful(this);
  assert.equal(isRunning(this, name), false);
  this.agentConfig.holdMachines = [];
});
When("I read the {string} run's record", function (this: FactoryWorld, name: string) {
  this.watchingRun = name;
  this.watched = readFileSync(join(this.factoryDir, "runs", name, "events.jsonl"), "utf8");
});
Then("it shows what every machine generated", function (this: FactoryWorld) {
  const recorded = events(this, this.watchingRun);
  for (const name of new Set(calls(this).map(call => call.machine))) {
    assert.ok(recorded.some(event => event.type === "text" && event.machine === name && event.text.length));
  }
});
Then("it shows what every machine spent", function (this: FactoryWorld) {
  const recorded = events(this, this.watchingRun);
  assert.equal(recorded.filter(event => event.type === "usage").length, calls(this).length);
  for (const usage of recorded.filter(event => event.type === "usage")) {
    assert.equal(usage.inputTokens, 101); assert.equal(usage.outputTokens, 23);
  }
});
Then("the record is in the run's folder in the factory, not in the target", function (this: FactoryWorld) {
  assert.ok(existsSync(join(this.factoryDir, "runs", this.watchingRun, "events.jsonl")));
  assert.equal(existsSync(join(this.codebase, "events.jsonl")), false);
});
When("I start the {string} run", function (this: FactoryWorld, name: string) {
  this.agentConfig.holdMachines = ["doer"]; start(this, name);
});
Then("the command has returned while the {string} run is running", async function (this: FactoryWorld, name: string) {
  successful(this);
  assert.ok(this.output.includes(`started run ${name}`), this.output);
  await until(() => existsSync(waitingPath(this, "doer")), "Doer did not start");
  assert.equal(daemonStatus(this).run, name);
  assert.equal(isRunning(this, name), true);
});
Then("the factory is running", function (this: FactoryWorld) { assert.equal(daemonStatus(this).running, true); });
Then("the factory is not running", function (this: FactoryWorld) { assert.equal(daemonStatus(this).running, false); });
Then("the {string} run is running", function (this: FactoryWorld, name: string) {
  assert.equal(isRunning(this, name), true); assert.equal(daemonStatus(this).run, name);
});
Then("the {string} run is not running", function (this: FactoryWorld, name: string) {
  assert.equal(isRunning(this, name), false); assert.notEqual(daemonStatus(this).run, name);
});
When("I stop the factory", async function (this: FactoryWorld) {
  invoke(this, ["stop"]); successful(this);
  await watcherFinished(this);
});

Given("the doer streams its first text without a newline", function (this: FactoryWorld) {
  this.agentConfig.partialText = true;
});
