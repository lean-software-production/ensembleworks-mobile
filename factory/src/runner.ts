import { existsSync } from "node:fs";
import { MachineConfig, AssemblyLine } from "./assembly-line";
import {
  plannerPrompt, doerPrompt, validatorPrompt, resultPrompt, synthesisPrompt,
  planAuthorPrompt, planReviewerPrompt, planSynthesisPrompt, planValidatorPrompt
} from "./prompts";
import { PlanReview } from "./plan-review";
import { Run } from "./runs";
import { initializeTarget, changedWork, commitWork } from "./work";
import { callMachine, MachineTurns } from "./acp";
import { RunRecord } from "./record";
import { Options } from "./options";

type Result = Record<string, unknown>;

export async function runFactory(options: Options, record: RunRecord, signal: AbortSignal,
  turns = new MachineTurns()): Promise<void> {
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
    signal.throwIfAborted();
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
    const result = await callMachine(machine, target, `${prompt}\n${resultPrompt(line.fields(node))}`, record, signal, turns);
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
    signal.throwIfAborted();
    if (fan) {
      const controller = new AbortController();
      const branchSignal = AbortSignal.any([signal, controller.signal]);
      let branchFailure: unknown;
      const work = fan.branches.some(name => ["reviewer", "validator", "plan_validator"].includes(line.machine(name).role))
        ? changedWork(target) : undefined;
      const settled = await Promise.allSettled(fan.branches.map(async name => {
        const branch = line.machine(name);
        // Each branch uses its own configuration, with the same current work snapshot.
        const branchPrompt = promptFor(branch, work);
        try {
          let report = await callMachine(branch, target,
            `${branchPrompt}${branch.prompt ? `\n${branch.prompt}` : ""}\n${resultPrompt(line.fields(name))}`, record, branchSignal, turns);
          if (branch.role === "plan_reviewer") report = { ...report, review: review!.reportContext() };
          branchSignal.throwIfAborted();
          return [name, report] as const;
        } catch (error) {
          if (!controller.signal.aborted) branchFailure = error;
          controller.abort();
          throw error;
        }
      }));
      if (branchFailure) throw branchFailure;
      reports = Object.fromEntries(settled.map(result => (result as PromiseFulfilledResult<readonly [string, Result]>).value));
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

}
