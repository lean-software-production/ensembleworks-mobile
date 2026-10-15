import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { connect, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Options, prepareRun, runFactory } from "./engine";
import { RunRecord, runsFolder } from "./record";

const socketPath = join(tmpdir(), `factory-${createHash("sha256").update(runsFolder).digest("hex").slice(0, 24)}.sock`);
interface Command { command: "start" | "stop" | "status"; name?: string; options?: Options; env?: NodeJS.ProcessEnv }
interface Reply { ok: boolean; message?: string; running?: boolean; run?: string }

export function request(command: Command): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const socket = connect(socketPath);
    let response = "";
    socket.setTimeout(10_000, () => socket.destroy(new Error("Factory daemon did not respond.")));
    socket.on("connect", () => socket.end(JSON.stringify(command) + "\n"));
    socket.on("data", chunk => { response += chunk.toString(); });
    socket.on("error", reject);
    socket.on("end", () => {
      try { resolve(JSON.parse(response)); } catch { reject(new Error("Invalid response from factory daemon.")); }
    });
  });
}

export async function startDaemon(): Promise<void> {
  try { await request({ command: "status" }); return; } catch (error) {
    if (!["ENOENT", "ECONNREFUSED"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
  }
  const child = spawn(process.execPath, [require.resolve("ts-node/dist/bin.js"), join(__dirname, "cli.ts"), "--daemon"], {
    detached: true, stdio: "ignore", env: { ...process.env, TS_NODE_TRANSPILE_ONLY: "true" }
  });
  let spawnError: Error | undefined;
  child.on("error", error => { spawnError = error; });
  child.unref();
  for (let attempt = 0; attempt < 150; attempt++) {
    if (spawnError) throw spawnError;
    try { await request({ command: "status" }); return; } catch {}
    await delay(20);
  }
  throw new Error("Could not start factory daemon.");
}

export async function serve(): Promise<void> {
  mkdirSync(runsFolder, { recursive: true });
  let active: { name: string; controller: AbortController; done: Promise<void> } | undefined;
  let shuttingDown = false;
  const stopRun = async () => {
    const current = active;
    if (current) { current.controller.abort(); await current.done; }
  };
  const server = createServer({ allowHalfOpen: true }, socket => {
    let input = "";
    socket.setTimeout(10_000, () => socket.destroy());
    socket.on("error", () => {});
    socket.on("data", chunk => { input += chunk.toString(); if (input.length > 2 * 1024 * 1024) socket.destroy(); });
    socket.on("end", async () => {
      let reply: Reply;
      let close = false;
      try {
        const command: Command = JSON.parse(input);
        if (command.command === "status") reply = { ok: true, running: !shuttingDown, run: active?.name };
        else if (command.command === "stop") {
          if (command.name && active?.name !== command.name) {
            reply = { ok: true, message: `run ${command.name} is not running` };
          } else {
            if (!command.name) shuttingDown = true;
            await stopRun();
            close = !command.name;
            reply = { ok: true, message: command.name ? `stopped run ${command.name}` : "factory stopped" };
          }
        } else if (command.command === "start" && command.options) {
          if (shuttingDown) throw new Error("Factory is stopping.");
          if (active) throw new Error(`refused: run ${active.name} is running`);
          const options = command.options;
          const env = command.env ?? process.env;
          const prepared = prepareRun(options, env);
          const record = new RunRecord(options.run);
          const controller = new AbortController();
          record.write({ type: "run", status: "running" });
          // Reserve the one run slot before allowing another client request.
          const current = { name: options.run, controller, done: Promise.resolve() };
          active = current;
          current.done = Promise.resolve().then(() => runFactory(options, prepared, record, controller.signal, env))
            .then(() => record.write({ type: "run", status: "finished" }))
            .catch(error => record.write({ type: "run", status: controller.signal.aborted ? "stopped" : "failed", text: String(error.message ?? error) }))
            .finally(() => { if (active === current) active = undefined; });
          reply = { ok: true, message: `started run ${options.run}` };
        } else throw new Error("Unknown daemon command.");
      } catch (error) { reply = { ok: false, message: error instanceof Error ? error.message : String(error) }; }
      socket.end(JSON.stringify(reply) + "\n");
      if (close) server.close();
    });
  });
  // A stale socket can survive a crash. Never unlink one owned by a live daemon.
  if (existsSync(socketPath)) {
    try { await request({ command: "status" }); return; } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ECONNREFUSED") throw error;
      unlinkSync(socketPath);
    }
  }
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, () => { chmodSync(socketPath, 0o600); resolve(); });
  });
  const shutdown = async () => { shuttingDown = true; await stopRun(); server.close(); };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  process.on("uncaughtException", shutdown);
  server.on("close", () => { process.removeListener("SIGTERM", shutdown); process.removeListener("SIGINT", shutdown); process.removeListener("uncaughtException", shutdown); });
}
