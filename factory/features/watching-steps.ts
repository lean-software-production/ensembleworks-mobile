import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { FactoryWorld } from "./world";
import { invoke, saveAgentConfig, calls, machineConfig } from "./steps";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

async function until(check: () => boolean, description: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${description}`);
    await delay(20);
  }
}
function status(world: FactoryWorld): { running: boolean; run?: string } {
  const result = spawnSync(join(world.repoRoot, "bin", "factory"), ["status"], {
    encoding: "utf8", env: { ...process.env, TS_NODE_TRANSPILE_ONLY: "true" }, timeout: 5000
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
function startRun(world: FactoryWorld, name: string): void {
  const fixture = world.runs[name];
  saveAgentConfig(world, fixture.plan);
  const earlier = calls(world).length;
  invoke(world, ["--run", name, "--target", fixture.target, "--seed", fixture.seed, "--line", fixture.line, "--attempts", String(world.attempts)]);
  world.lastCalls = calls(world).length - earlier;
}
async function attach(world: FactoryWorld, name: string): Promise<void> {
  assert.equal(world.watcher, undefined);
  world.watched = "";
  const child = spawn(join(world.repoRoot, "bin", "factory"), ["watch", name], {
    cwd: world.repoRoot, env: { ...process.env, TS_NODE_TRANSPILE_ONLY: "true" }
  });
  world.watcher = child;
  world.watchDone = new Promise((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
  child.stdout.on("data", chunk => { world.watched += chunk.toString(); });
  child.stderr.on("data", chunk => { world.watched += chunk.toString(); });
  await until(() => world.watched.includes("run running"), "watch attaches");
}
function record(world: FactoryWorld, name = "tetris"): any[] {
  return readFileSync(join(world.factoryDir, "runs", name, "record.jsonl"), "utf8").trim().split("\n").map(line => JSON.parse(line));
}


When('I watch the {string} run', async function (this: FactoryWorld, name: string) {
  if (status(this).run === name) {
    await attach(this, name);
    const marker = this.agentConfig.holdMachine === "reviewers" ? /reviewer_3\s+running/ : /doer\s+\|/;
    await until(() => marker.test(this.watched), "watch catches up to active machines");
    this.output = this.watched;
  } else {
    invoke(this, ["watch", name]);
    assert.equal(this.exitCode, 0, this.output);
  }
});
Then('it shows tokens in and tokens out for the {word}', function (this: FactoryWorld, machine: string) {
  assert.match(this.output, new RegExp(`tokens ${machine} 120 in / 30 out`));
});

Given('the reviewers run on Anthropic, Google and OpenAI models', function (this: FactoryWorld) {
  for (const [index, provider] of ["openai", "anthropic", "google"].entries()) {
    // Keep the model identifiers used by the doubles; provider attribution is explicit configuration.
    machineConfig(this, `reviewer_${index + 1}`, { provider });
  }
});
Then('it shows a total for each of Anthropic, Google and OpenAI', function (this: FactoryWorld) {
  const totals = this.output.trim().split("\n").filter(line => line.startsWith("tokens ")).at(-1)!;
  for (const provider of ["anthropic", "google", "openai"]) assert.match(totals, new RegExp(`${provider} \\d+`));
});
Then('it shows a total for the whole run', function (this: FactoryWorld) {
  const totals = this.output.trim().split("\n").filter(line => line.startsWith("tokens ")).at(-1)!;
  const providers = [...totals.matchAll(/(?:anthropic|google|openai) (\d+)/g)].reduce((sum, match) => sum + Number(match[1]), 0);
  assert.ok(providers > 0);
  assert.equal(Number(totals.match(/run (\d+)/)![1]), providers);
});

Given('I am watching the {string} run as it runs', async function (this: FactoryWorld, name: string) {
  this.agentConfig.holdMachine = "doer";
  startRun(this, name);
  assert.equal(this.exitCode, 0, this.output);
  await until(() => existsSync(join(this.workspace, "held-doer")), "doer is working");
  await attach(this, name);
});
When('the {string} run has run to the end', async function (this: FactoryWorld, name: string) {
  writeFileSync(join(this.workspace, "release-machines"), "release\n");
  assert.equal(await this.watchDone, 0, this.watched);
  this.output = this.watched;
  this.exitCode = 0;
  assert.equal(status(this).run, undefined);
});
Then("what I watched showed the doer's tokens go up", function (this: FactoryWorld) {
  const values = [...this.watched.matchAll(/tokens doer (\d+) in \/ (\d+) out/g)].map(match => Number(match[1]) + Number(match[2]));
  assert.deepEqual(values, [150, 300]);
});
Then("what I watched showed the run's total go up", function (this: FactoryWorld) {
  const values = [...this.watched.matchAll(/tokens .*?run (\d+)/g)].map(match => Number(match[1]));
  assert.ok(values.length >= 6);
  assert.ok(values.every((value, index) => index === 0 || value > values[index - 1]));
});

Given('the doer says {string}, then {string}', function (this: FactoryWorld, first: string, second: string) {
  this.agentConfig.doerLines = [first, second];
});
async function holdDoer(world: FactoryWorld, name: string, said = "started"): Promise<void> {
  world.agentConfig.holdMachine = "doer";
  world.agentConfig.doerLines ??= [said];
  startRun(world, name);
  assert.equal(world.exitCode, 0, world.output);
  await until(() => existsSync(join(world.workspace, "held-doer")) && record(world, name).some(event => event.type === "text" && event.machine === "doer" && event.text.includes(said)), "doer streams while held");
}
Given('the {string} run is running, with the doer part-way through an attempt, having said {string}', async function (this: FactoryWorld, name: string, said: string) {
  await holdDoer(this, name, said);
});
Given('the {string} run is running, with the doer part-way through an attempt', async function (this: FactoryWorld, name: string) {
  await holdDoer(this, name);
});
Then('I see {string} from the doer', function (this: FactoryWorld, text: string) {
  assert.ok(this.output.split("\n").some(line => /^doer\s+\|/.test(line) && line.includes(text)), this.output);
});
Then('I do not see {string}', function (this: FactoryWorld, text: string) {
  assert.ok(!this.output.includes(text), this.output);
  assert.equal(status(this).run, "tetris", "Observing the first line must leave the doer working");
});

Then('I see {string} from reviewer_1, reviewer_2 and reviewer_3', function (this: FactoryWorld, text: string) {
  for (const name of ["reviewer_1", "reviewer_2", "reviewer_3"]) {
    assert.ok(this.output.split("\n").some(line => line.startsWith(name) && line.includes("|") && line.includes(text)), this.output);
  }
});
Given('the {string} run is running, with every reviewer part-way through', async function (this: FactoryWorld, name: string) {
  this.agentConfig.holdMachine = "reviewers";
  startRun(this, name);
  assert.equal(this.exitCode, 0, this.output);
  await until(() => [1, 2, 3].every(index => existsSync(join(this.workspace, `held-reviewer_${index}`))), "all reviewers are working");
});
Then('it shows reviewer_1, reviewer_2 and reviewer_3 as running', function (this: FactoryWorld) {
  for (const name of ["reviewer_1", "reviewer_2", "reviewer_3"]) assert.match(this.output, new RegExp(`${name}\\s+running`));
  assert.equal(status(this).run, "tetris");
  assert.equal(calls(this, "synthesiser").length, 0);
});
Then('I see what the planner generated', function (this: FactoryWorld) {
  assert.match(this.output, /planner\s+\|.*"complete":false/);
});
Given('I am watching the {string} run', async function (this: FactoryWorld, name: string) { await attach(this, name); });
async function stopRun(world: FactoryWorld, name?: string): Promise<void> {
  invoke(world, name ? ["stop", name] : ["stop"]);
  assert.equal(world.exitCode, 0, world.output);
  for (const file of readdirSync(world.workspace).filter(file => file.startsWith("held-"))) {
    const pid = Number(readFileSync(join(world.workspace, file), "utf8"));
    assert.throws(() => process.kill(pid, 0), /ESRCH/, "Stop must wait for the active machines to exit");
  }
  // A subsequent invocation must create fresh agents instead of holding the new attempt.
  delete world.agentConfig.holdMachine;
  if (world.watcher) {
    assert.equal(await world.watchDone, 0, world.watched);
    world.output = world.watched;
  }
}
When('I stop the {string} run', async function (this: FactoryWorld, name: string) { await stopRun(this, name); });
Given('I have stopped the {string} run', async function (this: FactoryWorld, name: string) { await stopRun(this, name); });
When('I stop the factory', async function (this: FactoryWorld) { await stopRun(this); });
Then('what I am watching shows that the {string} run was stopped', function (this: FactoryWorld, name: string) {
  assert.match(this.watched, /run stopped/);
});
When("I read the {string} run's record", function (this: FactoryWorld, name: string) {
  this.output = JSON.stringify(record(this, name));
});
Then('it shows what every machine generated', function (this: FactoryWorld) {
  const events = JSON.parse(this.output);
  for (const machine of ["planner", "doer", "validator"]) {
    assert.ok(events.some((event: any) => event.type === "text" && event.machine === machine && event.text.includes("{")));
  }
});
Then('it shows what every machine spent', function (this: FactoryWorld) {
  const events = JSON.parse(this.output);
  for (const machine of ["planner", "doer", "validator"]) {
    assert.ok(events.some((event: any) => event.type === "usage" && event.machine === machine && event.inputTokens === 120 && event.outputTokens === 30));
  }
});
Then("the record is in the run's folder in the factory, not in the target", function (this: FactoryWorld) {
  assert.ok(existsSync(join(this.factoryDir, "runs", "tetris", "record.jsonl")));
  assert.equal(existsSync(join(this.codebase, "record.jsonl")), false);
});

When('I start the {string} run', function (this: FactoryWorld, name: string) {
  this.agentConfig.holdMachine = "doer";
  startRun(this, name);
});
Then('the command has returned while the {string} run is running', function (this: FactoryWorld, name: string) {
  assert.equal(this.exitCode, 0, this.output);
  assert.equal(status(this).run, name);
  assert.ok(record(this, name).some(event => event.type === "run" && event.status === "running"));
});
Then('the factory is running', function (this: FactoryWorld) { assert.equal(status(this).running, true); });
Then('the factory is not running', function (this: FactoryWorld) { assert.equal(status(this).running, false); });
Then('the {string} run is running', function (this: FactoryWorld, name: string) { assert.equal(status(this).run, name); });
Then('the {string} run is not running', function (this: FactoryWorld, name: string) { assert.notEqual(status(this).run, name); });

Given('the ACP agents split their text into chunks', function (this: FactoryWorld) { this.agentConfig.fragmentOutput = true; });
Given("the doer's model is {string}", function (this: FactoryWorld, model: string) { machineConfig(this, "doer", { model }); });
Then('the {word} ACP adapter received the configured model', function (this: FactoryWorld, harness: string) {
  assert.equal(this.exitCode, 0, this.output);
  const call = calls(this, "doer")[0];
  assert.ok(call);
  assert.ok(!call.args.includes("--model"), "Native adapters do not accept the Pi model CLI flag");
  if (harness === "claude") assert.deepEqual(call.sessionMeta, { claudeCode: { options: { settingSources: ["user"], model: "configured-model" } } });
  else assert.match(readFileSync(join(call.configDir, "config.toml"), "utf8"), /^model = "configured-model"$/m);
});
