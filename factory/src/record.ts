import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export const runsFolder = join(__dirname, "..", "runs");
export type RunStatus = "running" | "completed" | "stopped" | "failed";
export type Event =
  | { type: "run"; status: RunStatus; message?: string }
  | { type: "machine"; machine: string; status: "running" | "finished" | "stopped" }
  | { type: "text"; machine: string; text: string }
  | { type: "usage"; machine: string; provider: string; inputTokens: number; outputTokens: number };

export class RunRecord {
  readonly file: string;
  constructor(readonly name: string) {
    if (!/^[A-Za-z0-9][\w.-]*$/.test(name)) throw new Error("A run needs a name.");
    this.file = join(runsFolder, name, "events.jsonl");
  }
  append(event: Event): void {
    mkdirSync(join(runsFolder, this.name), { recursive: true });
    appendFileSync(this.file, JSON.stringify({ time: new Date().toISOString(), ...event }) + "\n");
  }
  events(): Event[] {
    if (!existsSync(this.file)) return [];
    // Ignore an unfinished final write; the next read will pick it up.
    return readFileSync(this.file, "utf8").split("\n").slice(0, -1).map(line => JSON.parse(line));
  }
}

export async function watch(name: string, write = (text: string) => process.stdout.write(text)): Promise<RunStatus> {
  const record = new RunRecord(name);
  if (!existsSync(record.file)) throw new Error(`There is no record for run ${name}.`);
  const machines = new Map<string, { input: number; output: number }>();
  const providers = new Map<string, number>();
  let openMachine: string | undefined;
  const running = new Set<string>();
  let seen = 0;
  let status: RunStatus = "running";
  function endLine(): void {
    if (openMachine) write("\n");
    openMachine = undefined;
  }
  function text(machine: string, chunk: string): void {
    if (openMachine && openMachine !== machine) endLine();
    const parts = chunk.split("\n");
    parts.forEach((part, index) => {
      if (part || index < parts.length - 1) {
        if (!openMachine) write(`${machine.padEnd(12)} | `);
        write(part);
        openMachine = machine;
      }
      if (index < parts.length - 1) endLine();
    });
  }
  do {
    const events = record.events();
    for (const event of events.slice(seen)) {
      if (event.type === "text") {
        text(event.machine, event.text);
      } else if (event.type === "machine") {
        endLine();
        if (event.status === "running") running.add(event.machine);
        else running.delete(event.machine);
        write(`running      ${[...running].join(", ") || "none"}\n`);
      } else if (event.type === "usage") {
        endLine();
        const total = machines.get(event.machine) ?? { input: 0, output: 0 };
        total.input += event.inputTokens;
        total.output += event.outputTokens;
        machines.set(event.machine, total);
        providers.set(event.provider, (providers.get(event.provider) ?? 0) + event.inputTokens + event.outputTokens);
        const bills = [...providers].map(([provider, value]) => `${provider} ${value}`).join("   ");
        const runTotal = [...providers.values()].reduce((sum, value) => sum + value, 0);
        write(`tokens       ${event.machine} ${total.input} in / ${total.output} out   ${bills}   run ${runTotal}\n`);
      } else {
        endLine();
        status = event.status;
        running.clear();
        write(`run ${name} ${status}${event.message ? `: ${event.message}` : ""}\n`);
      }
    }
    seen = events.length;
    if (status === "running") await delay(30);
  } while (status === "running");
  return status;
}
