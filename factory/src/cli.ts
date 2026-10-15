import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { AssemblyLine, MachineConfig } from "./assembly-line";
import {
  plannerPrompt, doerPrompt, validatorPrompt, resultPrompt, synthesisPrompt,
  planAuthorPrompt, planReviewerPrompt, planSynthesisPrompt, planValidatorPrompt
} from "./prompts";
import { PlanReview } from "./plan-review";
import { Run } from "./runs";
import { initializeTarget, changedWork, commitWork } from "./work";

type Result = Record<string, unknown>;

interface Options {
  run: string;
  line: string;
  seed: string;
  target: string;
  attempts: number;
  planRounds: number;
  checkLine: boolean;
}

function optionsFrom(argv: string[]): Options {
  let run = "";
  let line = "";
  let seed = "";
  let target = "";
  let attempts = 3;
  let planRounds = 3;
  let checkLine = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--run") run = argv[++index] ?? "";
    else if (argument === "--line") line = argv[++index] ?? "";
    else if (argument === "--seed") seed = argv[++index] ?? "";
    else if (argument === "--target") target = argv[++index] ?? "";
    else if (argument === "--attempts") attempts = Number(argv[++index]);
    else if (argument === "--plan-rounds") planRounds = Number(argv[++index]);
    else if (argument === "--check-line") checkLine = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!Number.isInteger(attempts) || attempts < 1) throw new Error("--attempts must be a positive integer");
  if (!Number.isInteger(planRounds) || planRounds < 1) throw new Error("--plan-rounds must be a positive integer");
  return { run, line, seed: seed ? resolve(seed) : "", target: target ? resolve(target) : "", attempts, planRounds, checkLine };
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
  if (!line.hasRole("plan_author") && ["plan_reviewer", "plan_synthesiser", "plan_validator", "plan_gate"].some(role => line.hasRole(role))) {
    throw new Error("A plan-first line requires a plan author.");
  }
  const review = line.hasRole("plan_author") ? new PlanReview(plan, options.planRounds) : undefined;
  run.remember();

  initializeTarget(target);
  let node = line.next("start", {});
  let pendingWork: Result | undefined;
  let committedTask: string | undefined;
  let findings: unknown[] = [];
  let attempts = 0;
  let reports: Record<string, Result> | undefined;

  function promptFor(machine: MachineConfig, work?: string): string {
    if (machine.role === "plan_author") return planAuthorPrompt(seed, plan, target, review!.context());
    if (machine.role === "plan_reviewer") {
      return planReviewerPrompt(machine.name, seed, plan, target, machine.lens, review!.context());
    }
    if (machine.role === "plan_validator") {
      if (!pendingWork || !review!.accepted) throw new Error("Plan validation requires current work and an accepted plan.");
      return planValidatorPrompt(seed, plan, target, machine.lens, work ?? changedWork(target), pendingWork) +
        `\nAccepted synthesis decision: ${review!.path}. Consult its dispositions when needed; do not edit it.`;
    }
    if (machine.role === "planner") return plannerPrompt(seed, plan, target, committedTask);
    if (machine.role === "doer") {
      return doerPrompt(seed, plan, target, findings) + (review
        ? `\nAccepted synthesis decision: ${review.path}. Consult its dispositions when needed; do not edit it.${review.taskName === undefined ? "" : `\nTask in progress: ${JSON.stringify(review.taskName)}. Stay on this task through retries and plan repair.`}` : "");
    }
    if (machine.role === "validator" || machine.role === "reviewer") {
      return validatorPrompt(seed, target, machine.lens, work ?? changedWork(target))
        .replace("You are the validator.", `You are the ${machine.role}.`);
    }
    return `You are the ${machine.name}.\nTarget: ${target}\nSeed: ${seed}\nPlan: ${plan}${review ? `\n${review.context()}` : ""}`;
  }

  while (node !== "finish") {
    const machine = line.machine(node);
    const joining = reports !== undefined;
    if (machine.role === "plan_author") review!.startRound();
    let prompt = joining
      ? (machine.role === "plan_synthesiser" ? planSynthesisPrompt(machine.name, reports!) : synthesisPrompt(machine.name, reports!))
      : promptFor(machine);
    reports = undefined;
    if (!joining && machine.role === "planner") committedTask = undefined;
    if (machine.role === "doer") {
      if (review && !review.accepted) throw new Error("Implementation requires an accepted plan.");
      if (attempts >= options.attempts) throw new Error(`A task hit its limit of ${options.attempts} attempts.`);
      attempts += 1;
    }
    if (machine.prompt) prompt += `\n${machine.prompt}`;
    const result = await callMachine(machine, target, `${prompt}\n${resultPrompt(line.fields(node))}`);
    const fan = line.fanOut(node);
    const next = fan ? fan.join : line.next(node, result);
    if (machine.role === "plan_author") review!.recordAuthor(result);
    if (machine.role === "plan_synthesiser") review!.recordDecision(result);
    if (machine.role === "doer") {
      review?.recordTask(result);
      pendingWork = result;
    }
    if (machine.role === "validator" || machine.role === "plan_validator" || (joining && machine.role !== "plan_synthesiser")) {
      if (!Array.isArray(result.findings)) throw new Error(`Could not read the ${machine.name}'s result.`);
      findings = result.findings;
    }
    if (machine.role === "plan_validator") {
      const decisions = ["satisfied", "retry", "replan"];
      if (decisions.some(field => typeof result[field] !== "boolean") ||
          decisions.filter(field => result[field]).length !== 1 ||
          (result.satisfied ? findings.length !== 0 : findings.length === 0)) {
        throw new Error("Plan validation must choose exactly one of satisfied, retry, or replan, with findings for failures.");
      }
      const destination = next === "finish" ? "finish" : line.machine(next).role;
      const expected = result.satisfied ? "planner" : result.retry ? "doer" : "plan_author";
      if (destination !== expected) throw new Error(`Plan validation must route this decision to a ${expected}.`);
      if (result.replan) review!.startRepair(findings, pendingWork);
    }
    console.log(JSON.stringify({ machine: node, ...result }));
    if (fan) {
      const controller = new AbortController();
      const work = fan.branches.some(name => ["reviewer", "validator", "plan_validator"].includes(line.machine(name).role))
        ? changedWork(target) : undefined;
      const results = await Promise.all(fan.branches.map(async name => {
        const branch = line.machine(name);
        // Each branch uses its own configuration, with the same current work snapshot.
        const branchPrompt = promptFor(branch, work);
        try {
          let report = await callMachine(branch, target,
            `${branchPrompt}${branch.prompt ? `\n${branch.prompt}` : ""}\n${resultPrompt(line.fields(name))}`, controller.signal);
          if (branch.role === "plan_reviewer") report = { ...report, review: review!.reportContext() };
          console.log(JSON.stringify({ machine: name, ...report }));
          return [name, report] as const;
        } catch (error) {
          controller.abort();
          throw error;
        }
      }));
      reports = Object.fromEntries(results);
      if (line.machine(fan.join).role === "plan_synthesiser") review!.recordReports(reports);
    }

    // Legacy lines accept on returning to a planner, including unchecked lines.
    // Plan-first lines accept work only after successful implementation validation:
    // accepting a repaired plan must never commit the previously rejected work.
    const mayCommit = !review || (machine.role === "plan_validator" && result.satisfied === true);
    if (!fan && next !== "finish" && line.machine(next).role === "planner" && pendingWork && mayCommit) {
      commitWork(target, typeof pendingWork.task === "string" ? pendingWork.task : "Factory task");
      review?.completeTask();
      committedTask = JSON.stringify(pendingWork);
      pendingWork = undefined;
      findings = [];
      attempts = 0;
    }
    if (next === "finish" && review && (!review.accepted || pendingWork)) {
      throw new Error("A plan-first run cannot finish with unaccepted work or an unaccepted plan.");
    }
    node = next;
  }
  console.log("factory stopped");
}

Promise.resolve().then(() => runFactory(optionsFrom(process.argv.slice(2)))).catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
