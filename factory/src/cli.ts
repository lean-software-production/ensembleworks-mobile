import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { AssemblyLine, MachineConfig } from "./assembly-line";
import { plannerPrompt, doerPrompt, validatorPrompt, resultPrompt, synthesisPrompt } from "./prompts";
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

async function callMachine(machine: MachineConfig, target: string, prompt: string, signal?: AbortSignal): Promise<Result> {
  const output = await new Promise<string>((resolve, reject) => {
    const args = ["-p", ...(machine.model ? ["--model", machine.model] : [])];
    const child = spawn(machine.harness, args, { cwd: target, signal });
    const chunks: Buffer[] = [];
    let bytes = 0;
    child.on("error", error => reject(new Error(`Could not run the ${machine.name}: ${error.message}`)));
    child.stdout.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 10 * 1024 * 1024) {
        child.kill();
        reject(new Error(`Could not run the ${machine.name}: output exceeds 10 MiB.`));
      } else chunks.push(chunk);
    });
    child.stderr.resume();
    child.stdin.on("error", () => {}); // An exiting harness can close stdin before consuming the prompt.
    child.on("close", status => status === 0
      ? resolve(Buffer.concat(chunks).toString("utf8"))
      : reject(new Error(`Could not run the ${machine.name}.`)));
    child.stdin.end(prompt);
  });
  const result = readResult(output);
  if (typeof result !== "object" || result === null || Array.isArray(result)) {
    throw new Error(`Could not read the ${machine.name}'s result.`);
  }
  return result as Result;
}

async function runFactory(options: Options): Promise<void> {
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
  let reports: Record<string, Result> | undefined;

  function promptFor(machine: MachineConfig, work?: string): string {
    if (machine.role === "planner") return plannerPrompt(seed, plan, target, committedTask);
    if (machine.role === "doer") return doerPrompt(seed, plan, target, findings);
    if (machine.role === "validator" || machine.role === "reviewer") {
      return validatorPrompt(seed, target, machine.lens, work ?? changedWork(target))
        .replace("You are the validator.", `You are the ${machine.role}.`);
    }
    return `You are the ${machine.name}.\nTarget: ${target}\nSeed: ${seed}\nPlan: ${plan}`;
  }

  while (node !== "finish") {
    const machine = line.machine(node);
    const joining = reports !== undefined;
    let prompt = joining ? synthesisPrompt(machine.name, reports!) : promptFor(machine);
    reports = undefined;
    if (!joining && machine.role === "planner") committedTask = undefined;
    if (machine.role === "doer") {
      if (attempts >= options.attempts) throw new Error(`A task hit its limit of ${options.attempts} attempts.`);
      attempts += 1;
    }
    if (machine.prompt) prompt += `\n${machine.prompt}`;
    const result = await callMachine(machine, target, `${prompt}\n${resultPrompt(line.fields(node))}`);
    const fan = line.fanOut(node);
    const next = fan ? fan.join : line.next(node, result);
    if (machine.role === "doer") pendingWork = result;
    if (machine.role === "validator" || joining) {
      if (!Array.isArray(result.findings)) throw new Error(`Could not read the ${machine.name}'s result.`);
      findings = result.findings;
    }
    console.log(JSON.stringify({ machine: node, ...result }));
    if (fan) {
      const controller = new AbortController();
      const work = changedWork(target);
      const results = await Promise.all(fan.branches.map(async name => {
        const branch = line.machine(name);
        // Each branch uses its own configuration, with the same current work snapshot.
        const branchPrompt = promptFor(branch, work);
        try {
          const report = await callMachine(branch, target,
            `${branchPrompt}${branch.prompt ? `\n${branch.prompt}` : ""}\n${resultPrompt(line.fields(name))}`, controller.signal);
          console.log(JSON.stringify({ machine: name, ...report }));
          return [name, report] as const;
        } catch (error) {
          controller.abort();
          throw error;
        }
      }));
      reports = Object.fromEntries(results);
    }

    // Returning to a planner accepts the task. The edge only routes; the factory
    // records work before the planner updates the plan, including unchecked lines.
    if (!fan && next !== "finish" && line.machine(next).role === "planner" && pendingWork) {
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

Promise.resolve().then(() => runFactory(optionsFrom(process.argv.slice(2)))).catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
