import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

type Result = Record<string, unknown>;
type Reports = Record<string, Result>;

interface ReviewState {
  episode: number;
  round: number;
  revision: number;
  status: "draft" | "reviewing" | "accepted" | "repair";
  findings: unknown[];
  changes: string;
  reports: Reports;
  previousReports: Reports;
  decision?: Result;
  previousDecision?: Result;
  task?: Result;
}

// Only machine results are kept here. The factory still never reads the plan.
export class PlanReview {
  readonly path: string;
  private state: ReviewState;

  constructor(plan: string, private readonly limit: number) {
    this.path = join(dirname(plan), "plan-review.json");
    this.state = existsSync(this.path) ? JSON.parse(readFileSync(this.path, "utf8")) : {
      episode: 1, round: 0, revision: 0, status: "draft", findings: [],
      changes: "Initial comprehensive plan; review every lens.", reports: {}, previousReports: {}
    };
    const state = this.state;
    if (!state || !Number.isInteger(state.episode) || state.episode < 1 ||
        !Number.isInteger(state.round) || state.round < 0 ||
        !Number.isInteger(state.revision) || state.revision < 0 ||
        !["draft", "reviewing", "accepted", "repair"].includes(state.status) ||
        !Array.isArray(state.findings) || typeof state.changes !== "string" ||
        !state.reports || !state.previousReports ||
        (state.status === "accepted" && state.decision?.satisfied !== true)) {
      throw new Error("Could not read the plan review state.");
    }
  }

  get accepted(): boolean { return this.state.status === "accepted"; }

  get taskName(): unknown { return this.state.task?.task; }

  recordTask(result: Result): void {
    if (typeof result.task !== "string" || !result.task.trim() ||
        (this.taskName !== undefined && this.taskName !== result.task)) {
      throw new Error("The doer must identify and stay on the current unfinished task.");
    }
    this.state.task = result;
    this.save(false);
  }

  completeTask(): void {
    this.state.task = undefined;
    this.save(false);
  }

  reportContext(): { episode: number; round: number; revision: number; changes: string } {
    const { episode, round, revision, changes } = this.state;
    return { episode, round, revision, changes };
  }

  context(): string {
    return `Plan review state: ${this.path}\nReview context:\n${JSON.stringify(this.state)}`;
  }

  startRound(): void {
    // A missing plan can send an accepted run back through its author.
    if (this.accepted) this.startRepair([], undefined);
    if (this.state.round >= this.limit) {
      throw new Error(`Plan review hit its limit of ${this.limit} rounds; unresolved findings are in ${this.path}.`);
    }
    this.state.round += 1;
    this.state.revision += 1;
    this.state.status = "reviewing";
    this.state.previousReports = this.state.reports;
    this.state.previousDecision = this.state.decision;
    this.state.reports = {};
    this.state.decision = undefined;
    this.save();
  }

  recordAuthor(result: Result): void {
    if (typeof result.changes !== "string" || !result.changes.trim()) {
      throw new Error("The plan author must report its changes.");
    }
    this.state.changes = result.changes;
    this.save();
  }

  recordReports(reports: Reports): void {
    for (const [name, report] of Object.entries(reports)) {
      if (!Array.isArray(report.findings)) throw new Error(`Could not read the ${name}'s plan findings.`);
      const ids = new Set<string>();
      for (const finding of report.findings) {
        if (!finding || typeof finding.id !== "string" || !finding.id.trim() ||
            typeof finding.issue !== "string" || !finding.issue.trim() || ids.has(finding.id)) {
          throw new Error(`Could not read the ${name}'s plan findings.`);
        }
        ids.add(finding.id);
      }
    }
    this.state.reports = reports;
    this.save();
  }

  recordDecision(result: Result): void {
    if (typeof result.satisfied !== "boolean" || !Array.isArray(result.findings) ||
        !Array.isArray(result.dispositions)) throw new Error("Could not read the plan synthesis decision.");
    const outstanding = new Set(Object.entries(this.state.reports).flatMap(([reviewer, report]) =>
      (report.findings as { id: string }[]).map(finding => JSON.stringify([reviewer, finding.id]))));
    for (const disposition of result.dispositions) {
      const key = JSON.stringify([disposition?.reviewer, disposition?.id]);
      if (!outstanding.delete(key) ||
          !["resolved", "rejected", "accepted_limitation", "revise"].includes(disposition.status) ||
          typeof disposition.reason !== "string" || !disposition.reason.trim() ||
          (result.satisfied && disposition.status === "revise")) {
        throw new Error("The plan synthesiser must explain the disposition of every finding.");
      }
    }
    if (outstanding.size) throw new Error("The plan synthesiser must explain the disposition of every finding.");
    if ((result.satisfied && result.findings.length) || (!result.satisfied && !result.findings.length)) {
      throw new Error("Plan synthesis findings must describe the revisions required before acceptance.");
    }
    this.state.decision = result;
    this.state.findings = result.findings;
    if (result.satisfied) this.state.status = "accepted";
    this.save();
  }

  startRepair(findings: unknown[], task?: Result): void {
    this.state.episode += 1;
    this.state.round = 0;
    this.state.status = "repair";
    this.state.findings = findings;
    this.state.task = task;
    this.state.changes = "Repair the plan defect, preserving the current task and completed work.";
    this.save();
  }

  private save(recordHistory = true): void {
    const folder = dirname(this.path);
    mkdirSync(folder, { recursive: true });
    const data = JSON.stringify(this.state, null, 2) + "\n";
    writeFileSync(`${this.path}.tmp`, data);
    renameSync(`${this.path}.tmp`, this.path);
    if (recordHistory && this.state.round) {
      const history = join(folder, "plan-reviews");
      mkdirSync(history, { recursive: true });
      writeFileSync(join(history, `episode-${this.state.episode}-round-${this.state.round}.json`), data);
    }
  }
}
