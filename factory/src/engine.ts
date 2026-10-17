import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { AssemblyLine, MachineConfig } from "./assembly-line";
import { machinePrompt, resultPrompt } from "./prompts";
import { prepareMachines } from "./harness";
import { ActiveMachines, callMachine } from "./acp";
import { RunRecord } from "./record";
import { PlanReview } from "./plan-review";
import { Run } from "./runs";
import { initializeTarget, changedWork, commitWork } from "./work";

type Result = Record<string, unknown>;

export interface Options {
  run: string;
  line: string;
  seed: string;
  target: string;
  attempts: number;
  planRounds: number;
  checkLine: boolean;
}

export function optionsFrom(argv: string[]): Options {
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

export function prepareRun(options: Options, env: NodeJS.ProcessEnv = process.env): { run: Run; line: AssemblyLine } {
  const run = new Run(options.run, { target: options.target, line: options.line, seed: options.seed });
  const { target, seed } = run.settings;
  if (!existsSync(seed)) throw new Error(`There is no seed at ${seed}.`);
  const line = new AssemblyLine(target, run.settings.line);
  if (!line.hasRole("plan_author") && ["plan_reviewer", "plan_synthesiser", "plan_validator", "plan_gate"].some(role => line.hasRole(role))) {
    throw new Error("A plan-first line requires a plan author.");
  }
  prepareMachines(line.allMachines(), env);
  run.remember();
  return { run, line };
}

export async function runFactory(options: Options, prepared: { run: Run; line: AssemblyLine }, record: RunRecord, signal: AbortSignal, env: NodeJS.ProcessEnv, active: ActiveMachines): Promise<void> {
  const { run, line } = prepared;
  const { target, seed } = run.settings;
  const plan = run.plan;
  const review = line.hasRole("plan_author") ? new PlanReview(plan, options.planRounds) : undefined;
  initializeTarget(target);
  let node = line.next("start", {});
  let pendingWork: Result | undefined;
  let committedTask: string | undefined;
  let commitReceipt: Result | undefined;
  let findings: unknown[] = [];
  let attempts = 0;
  let reports: Record<string, Result> | undefined;

  function promptFor(machine: MachineConfig, work?: string, branchReports?: Record<string, Result>): string {
    if (machine.role === "plan_validator" && (!pendingWork || !review!.accepted)) {
      throw new Error("Plan validation requires current work and an accepted plan.");
    }
    const joining = branchReports !== undefined;
    const accepted = review && ["doer", "plan_validator"].includes(machine.role)
      ? JSON.stringify({ decision: review.path, task: review.taskName }) : "";
    const data = {
      name: machine.role === "reviewer" ? "reviewer" : machine.name,
      seed: joining ? "" : seed, plan: joining ? "" : plan, target: joining ? "" : target,
      commit_receipt: committedTask ? JSON.stringify(commitReceipt ?? {}) : "",
      committed: committedTask ?? "", findings: JSON.stringify(findings),
      review: !joining && ["plan_author", "plan_reviewer", "plan_gate"].includes(machine.role) ? review?.context() ?? "" : "", accepted,
      task: JSON.stringify(pendingWork ?? {}), reports: JSON.stringify(branchReports ?? {}),
      work: !joining && ["validator", "reviewer", "plan_validator"].includes(machine.role)
        ? work ?? changedWork(target) : ""
    };
    return machinePrompt(machine.instructions, data) + `\nRun context:\n${JSON.stringify(joining ? { reports: branchReports } : data)}`;
  }

  while (node !== "finish") {
    signal.throwIfAborted();
    const machine = line.machine(node);
    const joining = reports !== undefined;
    if (machine.role === "plan_author") review!.startRound();
    const prompt = promptFor(machine, undefined, reports);
    reports = undefined;
    if (!joining && machine.role === "planner") { committedTask = undefined; commitReceipt = undefined; }
    if (machine.role === "doer") {
      if (review && !review.accepted) throw new Error("Implementation requires an accepted plan.");
      if (attempts >= options.attempts) throw new Error(`A task hit its limit of ${options.attempts} attempts.`);
      attempts += 1;
    }
    const result = await callMachine(machine, target, `${prompt}\n${resultPrompt(line.fields(node), machine.role)}`, record, signal, env, active);
    signal.throwIfAborted();
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
    if (fan) {
      const controller = new AbortController();
      const work = fan.branches.some(name => ["reviewer", "validator", "plan_validator"].includes(line.machine(name).role))
        ? changedWork(target) : undefined;
      let branchFailure: unknown;
      const settled = await Promise.allSettled(fan.branches.map(async name => {
        const branch = line.machine(name);
        // Each branch uses its own configuration, with the same current work snapshot.
        const branchPrompt = promptFor(branch, work);
        try {
          let report = await callMachine(branch, target,
            `${branchPrompt}\n${resultPrompt(line.fields(name), branch.role)}`, record, AbortSignal.any([signal, controller.signal]), env, active);
          if (branch.role === "plan_reviewer") report = { ...report, review: review!.reportContext() };
          return [name, report] as const;
        } catch (error) {
          branchFailure ??= error;
          controller.abort();
          throw error;
        }
      }));
      if (branchFailure) throw branchFailure;
      signal.throwIfAborted();
      reports = Object.fromEntries(settled.map(item => (item as PromiseFulfilledResult<readonly [string, Result]>).value));
      if (line.machine(fan.join).role === "plan_synthesiser") review!.recordReports(reports);
    }

    // Legacy lines accept on returning to a planner, including unchecked lines.
    // Plan-first lines accept work only after successful implementation validation:
    // accepting a repaired plan must never commit the previously rejected work.
    const mayCommit = !review || (machine.role === "plan_validator" && result.satisfied === true);
    if (!fan && next !== "finish" && line.machine(next).role === "planner" && pendingWork && mayCommit) {
      signal.throwIfAborted();
      const commit = commitWork(target, typeof pendingWork.task === "string" ? pendingWork.task : "Factory task");
      commitReceipt = { status: "committed", commit, task: pendingWork.task,
        validation: review ? { machine: machine.name, satisfied: true, checks: result.checks } : undefined };
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
}
