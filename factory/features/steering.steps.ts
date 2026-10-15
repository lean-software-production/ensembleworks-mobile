import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { FactoryWorld } from "./world";
import { calls, invoke, runFactory, successful } from "./steps";
import { events, release } from "./watching.steps";

function say(this: FactoryWorld, message: string, machine: string): void {
  const before = calls(this).length;
  invoke(this, ["say", this.watchingRun, machine, message]);
  this.lastCalls = calls(this).length - before;
  if (this.exitCode === 0) assert.equal(this.output.trim(), `delivered to ${machine}`);
}
When("I say {string} to the {word}", say);
When("I say {string} to {word}", say);
When("the doer finishes its attempt", function (this: FactoryWorld) { release(this); });
When("the reviewers finish", function (this: FactoryWorld) { release(this); });

function heard(world: FactoryWorld, machine: string, message: string): number {
  return events(world, world.watchingRun).filter(event => event.type === "text" && event.machine === machine &&
    event.text === `heard: ${message}\n`).length;
}
Then("reviewer_{int} heard {string}", function (this: FactoryWorld, reviewer: number, message: string) {
  successful(this);
  assert.equal(heard(this, `reviewer_${reviewer}`, message), 1);
});
Then("neither reviewer_{int} nor reviewer_{int} heard it", function (this: FactoryWorld, first: number, second: number) {
  const recorded = events(this, this.watchingRun);
  const sent = recorded.filter(event => event.type === "steering").at(-1);
  assert.ok(sent, "No delivered message recorded");
  for (const reviewer of [first, second]) assert.equal(heard(this, `reviewer_${reviewer}`, sent.text), 0);
});
Then("the doer heard {string} before it said {string}", function (this: FactoryWorld, message: string, later: string) {
  successful(this);
  const chunks = events(this, this.watchingRun).filter(event => event.type === "text" && event.machine === "doer");
  const heard = chunks.findIndex(event => event.text === `heard: ${message}\n`);
  const said = chunks.findIndex(event => event.text === `${later}\n`);
  assert.ok(heard >= 0 && said > heard, JSON.stringify(chunks));
});
Then("it says that the doer is what is running", function (this: FactoryWorld) {
  assert.equal(this.output.trim(), "refused: doer is what is running");
});
Given("the factory has run the {string} run", function (this: FactoryWorld, name: string) {
  this.watchingRun = name;
  runFactory(this, name);
  successful(this);
});
Then("it says that nothing is running", function (this: FactoryWorld) {
  assert.equal(this.output.trim(), "refused: nothing is running");
});
Then("the doer has been called twice", function (this: FactoryWorld) {
  successful(this);
  assert.equal(calls(this, "doer").length, 2);
});
Then("the doer heard {string} once", function (this: FactoryWorld, message: string) {
  assert.equal(heard(this, "doer", message), 1);
  for (const call of calls(this, "doer")) assert.ok(!call.prompt.includes(message), "Steering must not persist in prompts");
});
Then("the validator did not hear {string}", function (this: FactoryWorld, message: string) {
  successful(this);
  assert.ok(calls(this, "validator").length, "Validator must have run");
  assert.equal(heard(this, "validator", message), 0);
  for (const call of calls(this, "validator")) assert.ok(!call.prompt.includes(message));
});
Then("it shows that the doer was told {string}", function (this: FactoryWorld, message: string) {
  const sent = this.watched.trim().split("\n").map(line => JSON.parse(line))
    .filter(event => event.type === "steering" && event.machine === "doer");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].text, message);
  assert.ok(!Number.isNaN(Date.parse(sent[0].time)), "Delivery needs a timestamp");
});
Given("the adapter's steering response is {string}", function (this: FactoryWorld, response: string) {
  assert.ok(response === "promptRequired" || response === "unsupported");
  this.agentConfig.steeringResponse = response;
});
Then("no steering delivery is recorded", function (this: FactoryWorld) {
  assert.equal(events(this, this.watchingRun).filter(event => event.type === "steering").length, 0);
  assert.ok(!this.output.includes("delivered to"));
});
Then("watching shows that the doer was told {string}", function (this: FactoryWorld, message: string) {
  assert.ok(this.watched.includes(`told doer: ${message}\n`), this.watched);
  assert.ok(this.watched.includes(`run ${this.watchingRun} completed`), this.watched);
});
