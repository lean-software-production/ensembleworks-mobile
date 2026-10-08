import { After, setWorldConstructor, setDefaultTimeout, World } from "@cucumber/cucumber";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

setDefaultTimeout(20_000);

export interface AgentConfig {
  plannerInProse?: boolean;
  doerInProse?: boolean;
  validatorInProse?: boolean;
  invalidLastVerdict?: boolean;
  validatorPrefix?: string;
  writeSentinel?: boolean;
  doerNoChanges?: boolean;
  validation?: "always" | "reject-first" | "never";
  validatorField?: string;
  tasks?: string[];
  doerRename?: boolean;
  largeLockfile?: string;
}

export interface RunFixture {
  target: string;
  seed: string;
  line: string;
  plan: string;
}

export class FactoryWorld extends World {
  workspace = "";
  repoRoot = "";
  codebase = ""; // The selected target, never the factory source.
  targets: string[] = [];
  runs: Record<string, RunFixture> = {};
  runCalls: Record<string, { machine: string; cwd: string; plan: string }[]> = {};
  lastCalls = 0;
  lineName = "careful";
  factoryDir = "";
  callerCwd = "";
  seedPath = "";
  planPath = "";
  chosenAgent = "";
  fakeBin = "";
  callLog = "";
  configPath = "";
  attempts = 3;
  omitTarget = false;
  output = "";
  exitCode: number | null = null;
  initialCommitCount = 0;
  baselineHead = "";
  agentConfig: AgentConfig = {};
  unrelatedSnapshot: Record<string, string> = {};

  makeWorkspace(): void {
    // macOS /var is an alias of /private/var; cwd and Git report the physical path.
    this.workspace = realpathSync(mkdtempSync(join(tmpdir(), "lean-factory-")));
  }
}

setWorldConstructor(FactoryWorld);
After(function (this: FactoryWorld) {
  if (this.workspace) rmSync(this.workspace, { recursive: true, force: true });
});
