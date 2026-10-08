import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface Settings {
  target: string;
  line: string;
  seed: string;
}

const runsFolder = join(__dirname, "..", "runs");
const kinds: [keyof Settings, string][] = [["target", "a target"], ["line", "an assembly line"], ["seed", "a seed"]];

export class Run {
  readonly plan: string;
  readonly settings: Settings;
  private readonly file: string;

  constructor(readonly name: string, given: Partial<Settings>) {
    if (!/^[A-Za-z0-9][\w.-]*$/.test(name)) throw new Error("A run needs a name (--run <name>).");
    this.file = join(runsFolder, name, "run.json");
    this.plan = join(runsFolder, name, "plan.md");
    if (existsSync(this.file)) {
      const remembered: Settings = JSON.parse(readFileSync(this.file, "utf8"));
      for (const [key, kind] of kinds) {
        if (given[key] && given[key] !== remembered[key]) {
          throw new Error(`The "${name}" run already has ${kind}: ${remembered[key]}.`);
        }
      }
      this.settings = remembered;
    } else {
      if (!given.target) throw new Error("A target is required to start a run (--target <folder>).");
      if (!given.line) throw new Error("An assembly line is required to start a run (--line <name>).");
      if (!given.seed) throw new Error("There is no seed chosen to start a run (--seed <file>).");
      this.settings = { target: given.target, line: given.line, seed: given.seed };
    }
  }

  remember(): void {
    mkdirSync(dirname(this.file), { recursive: true });
    if (!existsSync(this.file)) writeFileSync(this.file, JSON.stringify(this.settings, null, 2) + "\n");
  }
}
