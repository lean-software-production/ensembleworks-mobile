import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { once } from "node:events";
import { MachineConfig } from "./assembly-line";
import { adapter, harnessInvocation, machineProvider } from "./harness";
import { RunRecord } from "./record";

export type ActiveMachines = Map<string, (text: string) => Promise<void>>;

export async function callMachine(machine: MachineConfig, target: string, prompt: string, record: RunRecord, signal: AbortSignal, env: NodeJS.ProcessEnv, active: ActiveMachines): Promise<Record<string, unknown>> {
  signal.throwIfAborted();
  const invocation = harnessInvocation(machine, env);
  const child = spawn(invocation.command, invocation.args, { cwd: target, env: invocation.env, detached: true });
  const closed = once(child, "close");
  const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  let nextId = 0;
  let output = "";
  let diagnostic = "";
  let failure: Error | undefined;
  let sessionId: string | undefined;
  const send = (message: object) => child.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...message }) + "\n");
  const fail = (error: Error) => {
    failure = error;
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };
  const kill = (force = false) => {
    if (child.pid) {
      try { process.kill(-child.pid, force ? "SIGKILL" : "SIGTERM"); } catch {}
    }
  };
  const abort = () => {
    if (sessionId && !child.stdin.destroyed) send({ method: "session/cancel", params: { sessionId } });
    fail(new Error("Run stopped."));
    kill();
  };
  signal.addEventListener("abort", abort, { once: true });
  child.stdin.on("error", error => fail(error));
  child.stderr.on("data", chunk => { diagnostic = (diagnostic + chunk.toString("utf8")).slice(-16_384); });
  child.on("error", error => fail(error));
  child.on("close", () => fail(new Error(diagnostic.trim() || "ACP agent closed the connection.")));
  // Attach a rejection handler immediately, including spawn failures.
  closed.catch(() => {});
  const lines = createInterface({ input: child.stdout });
  lines.on("line", line => {
    try {
      const message = JSON.parse(line);
      if (message.method === "session/update" && message.params?.sessionId === sessionId) {
        const update = message.params.update;
        if (update.sessionUpdate === "agent_message_chunk" && update.content?.type === "text") {
          output += update.content.text;
          if (Buffer.byteLength(output) > 10 * 1024 * 1024) throw new Error("Output exceeds 10 MiB.");
          record.write({ type: "text", machine: machine.name, text: update.content.text });
        }
      } else if (message.method && message.id !== undefined) {
        // Permission requests are handled explicitly; unsupported client tools fail clearly.
        if (message.method === "session/request_permission") {
          const option = message.params.options.find((item: any) => item.kind === "allow_once");
          send({ id: message.id, result: { outcome: option ? { outcome: "selected", optionId: option.optionId } : { outcome: "cancelled" } } });
        } else send({ id: message.id, error: { code: -32601, message: `Unsupported client method: ${message.method}` } });
      } else if (message.id !== undefined) {
        const request = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) request?.reject(new Error(message.error.message));
        else request?.resolve(message.result);
      }
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
      kill();
    }
  });
  const request = (method: string, params: object): Promise<any> => new Promise((resolve, reject) => {
    if (failure) return reject(failure);
    const id = nextId++;
    pending.set(id, { resolve, reject });
    send({ id, method, params });
  });
  let status = "failed";
  try {
    const initialized = await request("initialize", { protocolVersion: 1, clientCapabilities: {}, clientInfo: { name: "factory", version: "0.1.0" } });
    if (initialized.protocolVersion !== 1) throw new Error("Unsupported ACP protocol version.");
    const session = await request("session/new", {
      cwd: target, mcpServers: [],
      ...(adapter(machine) === "claude" ? { _meta: { claudeCode: { options: { settingSources: ["user"], ...(machine.model ? { model: machine.model } : {}) } } } } : {})
    });
    sessionId = session.sessionId;
    record.write({ type: "machine", machine: machine.name, status: "running" });
    const turn = request("session/prompt", { sessionId, prompt: [{ type: "text", text: prompt }] });
    active.set(machine.name, async text => {
      signal.throwIfAborted();
      const response = await request("_session/steering", { sessionId, prompt: [{ type: "text", text }] });
      if (response?.outcome !== "injected") throw new Error(`refused: ${machine.name} did not accept the message`);
      record.write({ type: "steering", machine: machine.name, text });
    });
    const response = await turn.finally(() => active.delete(machine.name));
    signal.throwIfAborted();
    if (response.usage) {
      const { inputTokens, outputTokens } = response.usage;
      if (![inputTokens, outputTokens].every(value => Number.isFinite(value) && value >= 0)) throw new Error("Invalid ACP token usage.");
      record.write({ type: "usage", machine: machine.name, provider: machineProvider(machine), inputTokens, outputTokens });
    }
    let result: unknown;
    for (const line of output.trimEnd().split(/\r?\n/).reverse()) {
      try { result = JSON.parse(line); break; } catch {}
    }
    if (typeof result !== "object" || result === null || Array.isArray(result)) throw new Error(`Could not read the ${machine.name}'s result.`);
    status = "finished";
    return result as Record<string, unknown>;
  } catch (error) {
    if (signal.aborted) throw new Error("Run stopped.");
    if (error instanceof Error && error.message.startsWith("Could not read")) throw error;
    throw new Error(`Could not run the ${machine.name}: ${error instanceof Error ? error.message : error}`);
  } finally {
    active.delete(machine.name);
    signal.removeEventListener("abort", abort);
    child.stdin.end();
    kill();
    const timer = setTimeout(() => kill(true), 1000);
    try { await closed; } catch {} finally { clearTimeout(timer); kill(true); lines.close(); }
    record.write({ type: "machine", machine: machine.name, status: signal.aborted ? "stopped" : status });
  }
}
