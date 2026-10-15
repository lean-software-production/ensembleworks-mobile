import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, openSync, closeSync, rmSync } from "node:fs";
import { createServer, request } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Options } from "./options";
import { RunRecord, runsFolder } from "./record";
import { runFactory } from "./runner";

// One endpoint per factory, with a short path even in deeply nested workspaces.
export const socket = join(tmpdir(), `lean-factory-${createHash("sha256").update(resolve(__dirname, "..")).digest("hex").slice(0, 20)}.sock`);

export function command(action: string, body: object = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = request({ socketPath: socket, path: `/${action}`, method: "POST" }, res => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { text += chunk; });
      res.on("end", () => {
        const response = JSON.parse(text);
        if (res.statusCode !== 200) reject(new Error(response.error));
        else resolve(response);
      });
    });
    req.on("error", reject);
    req.end(JSON.stringify(body));
  });
}

export async function ensureDaemon(): Promise<void> {
  mkdirSync(runsFolder, { recursive: true });
  const lock = join(runsFolder, ".daemon-start");
  for (let attempt = 0; attempt < 200; attempt++) {
    try { await command("status"); return; }
    catch (error) {
      if (!["ENOENT", "ECONNREFUSED"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
    }
    try { mkdirSync(lock); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      await delay(30); continue;
    }
    try {
      rmSync(socket, { force: true });
      const log = openSync(join(runsFolder, "daemon.log"), "a");
      const child = spawn(process.execPath, ["-r", require.resolve("ts-node/register"), join(__dirname, "cli.ts"), "--daemon"], {
        detached: true, stdio: ["ignore", log, log],
        env: { ...process.env, TS_NODE_PROJECT: join(__dirname, "..", "tsconfig.json"), TS_NODE_TRANSPILE_ONLY: "true" }
      });
      closeSync(log);
      child.unref();
      for (let wait = 0; wait < 200; wait++) {
        try { await command("status"); return; }
        catch { await delay(30); }
      }
      throw new Error("Factory daemon did not start; see factory/runs/daemon.log.");
    } finally { rmSync(lock, { recursive: true, force: true }); }
  }
  throw new Error("Factory daemon did not start.");
}

export function serve(): void {
  let active: { name: string; controller: AbortController; done: Promise<void> } | undefined;
  let closing = false;
  async function stopRun(): Promise<void> {
    const run = active;
    run?.controller.abort();
    await run?.done;
  }
  const server = createServer(async (req, res) => {
    try {
      req.setEncoding("utf8");
      let text = "";
      for await (const chunk of req) text += chunk.toString();
      const body = JSON.parse(text || "{}");
      let response: object;
      if (req.url === "/status") response = { running: true, run: active?.name ?? null };
      else if (req.url === "/start") {
        if (closing) throw new Error("Factory is stopping.");
        if (active) throw new Error(`refused: run ${active.name} is running`);
        const options = body as Options;
        const record = new RunRecord(options.run);
        const controller = new AbortController();
        record.append({ type: "run", status: "running" });
        const done = Promise.resolve().then(() => runFactory(options, record, controller.signal)).then(() => {
          record.append({ type: "run", status: controller.signal.aborted ? "stopped" : "completed" });
        }, error => {
          record.append({ type: "run", status: controller.signal.aborted ? "stopped" : "failed", message: controller.signal.aborted ? undefined : error.message });
        }).finally(() => { active = undefined; });
        active = { name: options.run, controller, done };
        response = { message: `started run ${options.run}` };
      } else if (req.url === "/stop") {
        if (body.name && active && body.name !== active.name) throw new Error(`Run ${body.name} is not running.`);
        if (!body.name) closing = true;
        await stopRun();
        response = { message: body.name ? `stopped run ${body.name}` : "factory stopped" };
        if (!body.name) server.close(() => { rmSync(socket, { force: true }); });
      } else throw new Error("Unknown factory command.");
      res.end(JSON.stringify(response));
    } catch (error) { res.statusCode = 400; res.end(JSON.stringify({ error: (error as Error).message })); }
  });
  server.listen(socket);
  async function shutdown(): Promise<void> {
    closing = true;
    await stopRun();
    server.close(() => { rmSync(socket, { force: true }); });
  }
  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
}
