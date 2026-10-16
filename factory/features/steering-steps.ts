import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { FactoryWorld } from "./world";
import { calls, invoke } from "./steps";
import { record } from "./watching-steps";

function heard(world: FactoryWorld, machine: string, message: string): number {
  return record(world).filter(event => event.type === "text" && event.machine === machine)
    .map(event => event.text).join("").split("\n").filter(line => line === `heard: ${JSON.stringify(message)}`).length;
}

function say(world: FactoryWorld, machine: string, text: string, run = "tetris"): void {
  const before = calls(world).length;
  invoke(world, ["say", run, machine, text]);
  world.lastCalls = calls(world).length - before;
}

When('I say {string} to the {word}', function (this: FactoryWorld, text: string, machine: string) {
  say(this, machine, text);
});
When('the doer finishes its attempt', function (this: FactoryWorld) {
  assert.equal(this.exitCode, 0, this.output);
  writeFileSync(join(this.workspace, "release-machines"), "release\n");
});
Then('the doer heard {string} before it said {string}', function (this: FactoryWorld, message: string, said: string) {
  const text = record(this).filter(event => event.type === "text" && event.machine === "doer").map(event => event.text).join("");
  const heard = text.indexOf(`heard: ${JSON.stringify(message)}\n`);
  assert.ok(heard >= 0, text);
  assert.ok(text.indexOf(said + "\n") > heard, text);
});
When('I say {string} to reviewer_{int}', function (this: FactoryWorld, text: string, index: number) {
  say(this, `reviewer_${index}`, text);
});
Then('it says that the doer is what is running', function (this: FactoryWorld) {
  assert.match(this.output, /refused: doer is what is running/);
  assert.ok(!record(this).some(event => event.type === "steering"));
});
Then('it says that nothing is running', function (this: FactoryWorld) {
  assert.match(this.output, /refused: nothing is running/);
  assert.ok(!record(this).some(event => event.type === "steering"));
});
Then('the doer has been called twice', function (this: FactoryWorld) {
  assert.equal(calls(this, "doer").length, 2);
});
Then('the doer heard {string} once', function (this: FactoryWorld, message: string) {
  assert.equal(heard(this, "doer", message), 1);
  assert.ok(calls(this, "doer").every(call => !call.prompt.includes(message)), "Steering must not become a prompt for a later attempt");
});
Then('the {word} did not hear {string}', function (this: FactoryWorld, machine: string, message: string) {
  assert.ok(calls(this, machine).length > 0);
  assert.equal(heard(this, machine, message), 0);
  assert.ok(calls(this, machine).every(call => !call.prompt.includes(message)));
});
Given('the adapter refuses steering as {word}', function (this: FactoryWorld, reason: "inactive" | "unsupported") {
  this.agentConfig.steeringRefusal = reason;
});
When('I say {string} to {word} in the {string} run', function (this: FactoryWorld, text: string, machine: string, run: string) {
  say(this, machine, text, run);
});
Then('no steering delivery is recorded', function (this: FactoryWorld) {
  assert.ok(!record(this).some(event => event.type === "steering"));
});
Then('it shows that the doer was told {string}', function (this: FactoryWorld, message: string) {
  const events = JSON.parse(this.output);
  const delivered = events.filter((event: any) => event.type === "steering");
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].machine, "doer");
  assert.equal(delivered[0].text, message);
  assert.ok(Number.isFinite(Date.parse(delivered[0].time)));
  invoke(this, ["watch", "tetris"]);
  assert.equal(this.exitCode, 0, this.output);
  assert.ok(this.output.includes(`doer         told ${JSON.stringify(message)}`), this.output);
});
When('the reviewers finish', function (this: FactoryWorld) {
  assert.equal(this.exitCode, 0, this.output);
  writeFileSync(join(this.workspace, "release-machines"), "release\n");
});
Then('reviewer_{int} heard {string}', function (this: FactoryWorld, index: number, message: string) {
  assert.equal(heard(this, `reviewer_${index}`, message), 1);
});
Then('neither reviewer_{int} nor reviewer_{int} heard it', function (this: FactoryWorld, first: number, second: number) {
  for (const index of [first, second]) {
    assert.ok(!record(this).some(event => event.type === "text" && event.machine === `reviewer_${index}` && event.text.includes("heard:")));
  }
});
