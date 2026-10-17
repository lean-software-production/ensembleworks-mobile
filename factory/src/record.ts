import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const runsFolder = join(__dirname, "..", "runs");
export type RunEvent = {
  type: "run" | "machine" | "text" | "usage" | "steering" | "diagnostic";
  time?: string;
  status?: string;
  machine?: string;
  text?: string;
  provider?: string;
  inputTokens?: number;
  outputTokens?: number;
  // Absent means the adapter did not report this counter for every model turn.
  cachedReadTokens?: number;
  cachedWriteTokens?: number;
  stopReason?: string;
  modelStopReasons?: string[];
  outputBytes?: number;
  outputTail?: string;
};

export function recordPath(name: string): string {
  if (!/^[A-Za-z0-9][\w.-]*$/.test(name)) throw new Error("Invalid run name.");
  return join(runsFolder, name, "record.jsonl");
}

export class RunRecord {
  readonly path: string;
  constructor(name: string) {
    this.path = recordPath(name);
    mkdirSync(join(runsFolder, name), { recursive: true });
  }
  write(event: RunEvent): void {
    appendFileSync(this.path, JSON.stringify({ ...event, time: new Date().toISOString() }) + "\n");
  }
}

export function readRecord(name: string): RunEvent[] {
  const path = recordPath(name);
  if (!existsSync(path)) throw new Error(`There is no record for run ${name}.`);
  // Ignore an unfinished final write; a following read will pick it up.
  return readFileSync(path, "utf8").split("\n").slice(0, -1).filter(Boolean).map(line => JSON.parse(line));
}

export class RecordDisplay {
  private readonly partial = new Map<string, string>();
  private readonly machines = new Map<string, { input: number; output: number }>();
  private readonly providers = new Map<string, number>();
  constructor(private readonly print: (line: string) => void) {}
  show(event: RunEvent): void {
    const name = event.machine ?? "";
    if (event.type === "text") {
      const lines = ((this.partial.get(name) ?? "") + event.text).split(/\r?\n/);
      this.partial.set(name, lines.pop()!);
      for (const line of lines) this.print(`${name.padEnd(12)} | ${line}`);
    } else if (event.type === "steering") {
      this.print(`${name.padEnd(12)} told ${JSON.stringify(event.text)}`);
    } else if (event.type === "diagnostic") {
      this.print(`${name.padEnd(12)} diagnostic: ${event.text} (${event.outputBytes} output bytes; stop ${event.stopReason ?? "unknown"})`);
    } else if (event.type === "machine") {
      if (event.status !== "running" && this.partial.get(name)) {
        this.print(`${name.padEnd(12)} | ${this.partial.get(name)}`);
        this.partial.delete(name);
      }
      this.print(`${name.padEnd(12)} ${event.status}`);
    } else if (event.type === "usage") {
      const total = this.machines.get(name) ?? { input: 0, output: 0 };
      total.input += event.inputTokens!;
      total.output += event.outputTokens!;
      this.machines.set(name, total);
      const provider = event.provider!;
      this.providers.set(provider, (this.providers.get(provider) ?? 0) + event.inputTokens! + event.outputTokens!);
      const all = [...this.providers.values()].reduce((a, b) => a + b, 0);
      this.print(`tokens ${name} ${total.input} in / ${total.output} out   ${[...this.providers].map(([p, n]) => `${p} ${n}`).join("   ")}   run ${all}`);
    } else if (event.type === "run") {
      this.print(`run ${event.status}${event.text ? `: ${event.text}` : ""}`);
    }
  }
}
