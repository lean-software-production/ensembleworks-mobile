import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const projectPaths = [".", ":(exclude).factory"];
const planPath = ".factory/plan.md";

function git(target: string, args: string[], allowedStatuses = [0]): string {
  const result = spawnSync("git", ["-C", target, ...args], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  if (result.error || !allowedStatuses.includes(result.status ?? -1)) {
    throw new Error(result.error?.message || result.stderr.trim() || "Git command failed");
  }
  return result.stdout;
}

export function initializeTarget(target: string): void {
  mkdirSync(target, { recursive: true });
  const repository = git(target, ["rev-parse", "--show-toplevel"], [0, 128]).trim();
  if (!repository) git(target, ["init", "-q"]);
  mkdirSync(join(target, ".factory"), { recursive: true });
}

function reference(target: string): string {
  return git(target, ["rev-parse", "--verify", "HEAD"], [0, 128]).trim() ||
    git(target, ["hash-object", "-t", "tree", "-w", "--stdin"]).trim();
}

function untrackedFiles(target: string, paths = projectPaths, respectIgnores = true): string[] {
  return git(target, ["ls-files", "--others", ...(respectIgnores ? ["--exclude-standard"] : []), "-z", "--", ...paths])
    .split("\0").filter(Boolean);
}

function changedFiles(target: string, paths: string[]): string[] {
  return git(target, ["diff", "--relative", "--no-renames", reference(target), "--name-only", "-z", "--", ...paths])
    .split("\0").filter(Boolean);
}

function changedPlan(target: string): string[] {
  return [...new Set([...changedFiles(target, [planPath]), ...untrackedFiles(target, [planPath], false)])];
}

export function changedWork(target: string): string {
  const tracked = git(target, ["diff", "--no-ext-diff", "--relative", reference(target), "--", ...projectPaths]);
  const untracked = untrackedFiles(target).map((file) =>
    git(target, ["diff", "--no-ext-diff", "--no-index", "--", "/dev/null", join(target, file)], [0, 1])
  );
  return [tracked, ...untracked].join("\n");
}

function commitFiles(target: string, files: string[], message: string): void {
  if (!files.length) return;
  // New files need staging, including the plan if an ignore rule hides it.
  // --only records tracked paths directly, even an already-staged deletion.
  const newFiles = untrackedFiles(target, files, false);
  if (newFiles.length) git(target, ["add", "-f", "--", ...newFiles]);
  // --only leaves unrelated staged and unstaged changes exactly as they were.
  git(target, ["commit", "--only", "-m", message, "--", ...files]);
}

export function commitWork(target: string, task: string): void {
  const work = [...new Set([...changedFiles(target, projectPaths), ...untrackedFiles(target)])];
  if (!work.length) throw new Error("Validated task produced no committable work; the plan has not advanced.");
  commitFiles(target, [...work, ...changedPlan(target)], task);
}

export function recordFinalPlan(target: string): void {
  commitFiles(target, changedPlan(target), "Record final plan");
}
