import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { AssemblyLine, MachineConfig } from "./assembly-line";
import { plannerPrompt, doerPrompt, validatorPrompt, resultPrompt } from "./prompts";
import { Run } from "./runs";
import { initializeTarget, changedWork, commitWork } from "./work";

type Result = Record<string, unknown>;

interface Options {
  run: string;
  line: string;
  seed: string;
  target: string;
  attempts: number;
  checkLine: boolean;
}

function optionsFrom(argv: string[]): Options {
  let run = "";
  let line = "";
  let seed = "";
  let target = "";
  let attempts = 3;
  let checkLine = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--run") run = argv[++index] ?? "";
    else if (argument === "--line") line = argv[++index] ?? "";
    else if (argument === "--seed") seed = argv[++index] ?? "";
    else if (argument === "--target") target = argv[++index] ?? "";
    else if (argument === "--attempts") attempts = Number(argv[++index]);
    else if (argument === "--check-line") checkLine = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!Number.isInteger(attempts) || attempts < 1) throw new Error("--attempts must be a positive integer");
  return { run, line, seed: seed ? resolve(seed) : "", target: target ? resolve(target) : "", attempts, checkLine };
}

function readResult(output: string): unknown {
  const lines = output.split(/\r?\n/);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch {
      // Only the last line that parses as JSON is the result, not earlier commentary.
    }
  }
  return undefined;
}

function callMachine(machine: MachineConfig, target: string, prompt: string): Result {
  const answer = spawnSync(machine.harness, ["-p"], {
    cwd: target,
    input: prompt,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024
  });
  if (answer.error || answer.status !== 0) {
    throw new Error(`Could not run the ${machine.name}${answer.error ? `: ${answer.error.message}` : "."}`);
  }
  const result = readResult(answer.stdout);
  if (typeof result !== "object" || result === null || Array.isArray(result)) {
    throw new Error(`Could not read the ${machine.name}'s result.`);
  }
  return result as Result;
}

function runFactory(options: Options): void {
  if (options.checkLine) {
    if (!options.target || !options.line) throw new Error("Checking a line needs --target <folder> and --line <name>.");
    new AssemblyLine(options.target, options.line);
    console.log("Assembly line accepted.");
    return;
  }
  const run = new Run(options.run, { target: options.target, line: options.line, seed: options.seed });
  const { target, seed } = run.settings;
  const plan = run.plan;
  if (!existsSync(seed)) throw new Error(`There is no seed at ${seed}.`);
  const line = new AssemblyLine(target, run.settings.line);
  run.remember();

  initializeTarget(target);
  let node = line.next("start", {});
  let pendingWork: Result | undefined;
  let committedTask: string | undefined;
  let findings: unknown[] = [];
  let attempts = 0;

  while (node !== "finish") {
    const machine = line.machine(node);
    let prompt: string;
    if (machine.role === "planner") {
      prompt = plannerPrompt(seed, plan, target, committedTask);
      committedTask = undefined;
    } else if (machine.role === "doer") {
      if (attempts >= options.attempts) throw new Error(`A task hit its limit of ${options.attempts} attempts.`);
      attempts += 1;
      prompt = doerPrompt(seed, plan, target, findings);
    } else if (machine.role === "validator") {
      prompt = validatorPrompt(seed, target, machine.lens, changedWork(target));
    } else {
      prompt = `You are the ${machine.name}.\nTarget: ${target}\nSeed: ${seed}\nPlan: ${plan}`;
    }
    if (machine.prompt) prompt += `\n${machine.prompt}`;
    const result = callMachine(machine, target, `${prompt}\n${resultPrompt(line.fields(node))}`);
    const next = line.next(node, result);
    if (machine.role === "doer") pendingWork = result;
    if (machine.role === "validator") {
      if (!Array.isArray(result.findings)) throw new Error(`Could not read the ${machine.name}'s result.`);
      findings = result.findings;
    }
    console.log(JSON.stringify({ machine: node, ...result }));

    // Returning to a planner accepts the task. The edge only routes; the factory
    // records work before the planner updates the plan, including unchecked lines.
    if (next !== "finish" && line.machine(next).role === "planner" && pendingWork) {
      commitWork(target, typeof pendingWork.task === "string" ? pendingWork.task : "Factory task");
      committedTask = JSON.stringify(pendingWork);
      pendingWork = undefined;
      findings = [];
      attempts = 0;
    }
    node = next;
  }
  console.log("factory stopped");
}

try {
  runFactory(optionsFrom(process.argv.slice(2)));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
