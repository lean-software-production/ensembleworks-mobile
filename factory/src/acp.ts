import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { MachineConfig } from "./assembly-line";
import { RunRecord } from "./record";

type Result = Record<string, unknown>;

function readResult(output: string): Result {
  for (const line of output.split(/\r?\n/).reverse()) {
    try {
      const value = JSON.parse(line);
      if (!value || typeof value !== "object" || Array.isArray(value)) break;
      return value;
    } catch { /* Commentary before the last JSON result is allowed. */ }
  }
  throw new Error("No JSON result");
}

export async function callMachine(machine: MachineConfig, target: string, prompt: string,
  record: RunRecord, signal: AbortSignal): Promise<Result> {
  signal.throwIfAborted();
  const child = spawn(machine.harness, machine.model ? ["--model", machine.model] : [], {
    cwd: target, detached: process.platform !== "win32", stdio: ["pipe", "pipe", "pipe"]
  });
  let nextId = 1;
  let sessionId: string | undefined;
  let output = "";
  let failure: Error | undefined;
  const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  const closed = new Promise<void>(resolve => child.once("close", () => resolve()));
  function fail(error: Error): void {
    failure = error;
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  }
  function send(message: object): void {
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...message }) + "\n");
  }
  function request(method: string, params: object): Promise<any> {
    if (failure) return Promise.reject(failure);
    const id = nextId++;
    return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); send({ id, method, params }); });
  }
  function recordUsage(usage: { inputTokens?: number; outputTokens?: number }): void {
    record.append({ type: "usage", machine: machine.name, provider: machine.provider ?? "unknown",
      inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0 });
  }
  function kill(signal: NodeJS.Signals): void {
    if (!child.pid) return;
    try {
      if (process.platform === "win32") child.kill(signal);
      else process.kill(-child.pid, signal);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
  }
  function abort(): void {
    if (sessionId) send({ method: "session/cancel", params: { sessionId } });
    fail(new Error("Run stopped"));
    kill("SIGTERM");
  }
  child.on("error", error => fail(new Error(`Could not run the ${machine.name}: ${error.message}`)));
  child.on("close", () => fail(new Error(`Could not run the ${machine.name}.`)));
  child.stdin.on("error", () => {});
  child.stderr.resume();
  const reader = createInterface({ input: child.stdout });
  reader.on("line", line => {
    try {
      const message = JSON.parse(line);
      if (message.method === "session/update") {
        const update = message.params.update;
        if (update.sessionUpdate === "agent_message_chunk" && update.content.type === "text") {
          output += update.content.text;
          record.append({ type: "text", machine: machine.name, text: update.content.text });
        }
      } else if (message.method && message.id !== undefined) {
        // The client advertises no filesystem or terminal capabilities. Permission
        // prompts require an operator; unattended runs never approve them silently.
        if (message.method === "session/request_permission") {
          send({ id: message.id, result: { outcome: { outcome: "cancelled" } } });
        } else send({ id: message.id, error: { code: -32601, message: "Unsupported client method" } });
      } else {
        const waiter = pending.get(message.id);
        if (waiter) {
          pending.delete(message.id);
          if (message.error) {
            if (message.error.data?.usage) recordUsage(message.error.data.usage);
            waiter.reject(new Error(`Could not run the ${machine.name}: ${message.error.message}`));
          }
          else waiter.resolve(message.result);
        }
      }
    } catch (error) { fail(new Error(`Could not run the ${machine.name}: ${String(error)}`)); }
  });
  signal.addEventListener("abort", abort, { once: true });
  record.append({ type: "machine", machine: machine.name, status: "running" });
  try {
    const initialized = await request("initialize", {
      protocolVersion: 1, clientCapabilities: {}, clientInfo: { name: "lean-factory", version: "006" }
    });
    if (initialized.protocolVersion !== 1) throw new Error(`Could not run the ${machine.name}: unsupported ACP version`);
    const session = await request("session/new", { cwd: target, mcpServers: [] });
    sessionId = session.sessionId;
    const response = await request("session/prompt", { sessionId, prompt: [{ type: "text", text: prompt }] });
    signal.throwIfAborted();
    if (response.stopReason === "cancelled") throw new Error(`Could not run the ${machine.name}: prompt cancelled`);
    if (response.usage) recordUsage(response.usage);
    try { return readResult(output); }
    catch {
      throw new Error(`Could not read the ${machine.name}'s result: ${output.trim()
        ? "expected a final single-line JSON object (see the run record)."
        : "the agent returned no answer text."}`);
    }
  } finally {
    signal.removeEventListener("abort", abort);
    child.stdin.end();
    kill("SIGTERM");
    const force = setTimeout(() => kill("SIGKILL"), 500);
    await closed;
    clearTimeout(force);
    kill("SIGKILL"); // Reap any tools that outlived their adapter in this process group.
    reader.close();
    record.append({ type: "machine", machine: machine.name, status: signal.aborted ? "stopped" : "finished" });
  }
}
