import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { read } from "graphlib-dot";

export interface MachineConfig {
  name: string;
  role: string;
  harness: string;
  lens: string;
  prompt?: string;
}

interface Edge {
  to: string;
  field?: string;
  expected?: boolean;
}

export class AssemblyLine {
  private readonly machines = new Map<string, MachineConfig>();
  private readonly outgoing = new Map<string, Edge[]>();

  constructor(folder: string) {
    const graph = read(readFileSync(join(folder, "assembly-line.dot"), "utf8"));
    if (!graph.isDirected() || !graph.hasNode("start") || !graph.hasNode("finish")) {
      throw new Error("The assembly line must be directed and have start and finish nodes.");
    }
    for (const name of graph.nodes()) {
      this.outgoing.set(name, []);
      if (name === "start" || name === "finish") continue;
      const file = join(folder, name, "machine.json");
      if (!existsSync(file)) throw new Error(`The factory has no machine called "${name}".`);
      const config = JSON.parse(readFileSync(file, "utf8"));
      this.machines.set(name, {
        name,
        role: config.role ?? name,
        harness: config.harness ?? "pi",
        lens: config.lens ?? (config.lensFile ? readFileSync(resolve(dirname(file), config.lensFile), "utf8") : ""),
        prompt: config.prompt
      });
    }
    for (const edge of graph.edges()) {
      const label: string | undefined = graph.edge(edge)?.label;
      const negated = label?.startsWith("not ") ?? false;
      this.outgoing.get(edge.v)!.push({
        to: edge.w,
        field: label ? (negated ? label.slice(4) : label) : undefined,
        expected: label ? !negated : undefined
      });
      if (edge.w === "finish" && this.machines.get(edge.v)?.role !== "planner") {
        throw new Error("Only a planner may have an edge to finish.");
      }
    }
    // Reverse reachability includes retry cycles without assuming a fixed route.
    const canFinish = new Set(["finish"]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [name, edges] of this.outgoing) {
        if (!canFinish.has(name) && edges.some((edge) => canFinish.has(edge.to))) {
          canFinish.add(name);
          changed = true;
        }
      }
    }
    for (const name of [...graph.nodes()].reverse()) {
      if (!canFinish.has(name)) throw new Error(`Finish cannot be reached from ${name}.`);
    }
  }

  machine(name: string): MachineConfig {
    return this.machines.get(name)!;
  }

  fields(name: string): string[] {
    return [...new Set(this.outgoing.get(name)!.flatMap((edge) => edge.field ? [edge.field] : []))];
  }

  next(name: string, result: Record<string, unknown>): string {
    for (const field of this.fields(name)) {
      if (!(field in result)) throw new Error(`The result of ${name} has no field "${field}".`);
      if (typeof result[field] !== "boolean") throw new Error(`The result of ${name} has a non-boolean field "${field}".`);
    }
    const matching = this.outgoing.get(name)!.filter((edge) => !edge.field || result[edge.field] === edge.expected);
    if (matching.length !== 1) throw new Error(`The assembly line must select exactly one edge from ${name}.`);
    return matching[0].to;
  }
}
