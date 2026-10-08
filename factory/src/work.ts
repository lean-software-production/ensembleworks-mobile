import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const projectPaths = [".", ":(exclude).assembly-lines"];

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

export function changedWork(target: string): string {
  const tracked = git(target, ["diff", "--no-ext-diff", "--relative", reference(target), "--", ...projectPaths]);
  const untracked = untrackedFiles(target).map((file) =>
    git(target, ["diff", "--no-ext-diff", "--no-index", "--", "/dev/null", join(target, file)], [0, 1])
  );
  return [tracked, ...untracked].join("\n");
}

export function commitWork(target: string, task: string): void {
  const newFiles = untrackedFiles(target);
  const work = [...new Set([...changedFiles(target, projectPaths), ...newFiles])];
  if (!work.length) throw new Error("Validated task produced no committable work; the plan has not advanced.");
  // New files need staging; --only records tracked paths directly, even an already-staged deletion.
  if (newFiles.length) git(target, ["add", "--", ...newFiles]);
  // --only leaves unrelated staged and unstaged changes exactly as they were.
  git(target, ["commit", "--only", "-m", task, "--", ...work]);
}
