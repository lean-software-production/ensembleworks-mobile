import { setTimeout as delay } from "node:timers/promises";
import { AssemblyLine } from "./assembly-line";
import { optionsFrom } from "./engine";
import { request, serve, startDaemon } from "./daemon";
import { readRecord, RecordDisplay } from "./record";

async function main(argv: string[]): Promise<void> {
  if (argv[0] === "--daemon") return serve();
  if (argv[0] === "watch") {
    if (argv.length !== 2) throw new Error("Usage: factory watch <run>");
    const display = new RecordDisplay(line => console.log(line));
    let count = 0;
    while (true) {
      const events = readRecord(argv[1]);
      for (const event of events.slice(count)) display.show(event);
      count = events.length;
      const last = events.filter(event => event.type === "run").at(-1);
      if (last && last.status !== "running") {
        if (last.status === "failed") process.exitCode = 1;
        return;
      }
      const status = await request({ command: "status" }).catch(() => ({ run: undefined }));
      if (status.run !== argv[1]) {
        const latest = readRecord(argv[1]);
        if (latest.length !== count) continue;
        throw new Error(`Run ${argv[1]} is no longer running.`);
      }
      await delay(40);
    }
  }
  if (argv[0] === "stop" || argv[0] === "status") {
    if (argv.length > 2) throw new Error(`Usage: factory ${argv[0]} [run]`);
    const command = argv[0];
    const reply = await request({ command, name: argv[1] }).catch((error: NodeJS.ErrnoException) => {
      if (!["ENOENT", "ECONNREFUSED"].includes(error.code ?? "")) throw error;
      return { ok: true, running: false, run: undefined, message: "factory stopped" };
    });
    if (!reply.ok) throw new Error(reply.message);
    console.log(command === "status" ? JSON.stringify(reply) : reply.message);
    return;
  }
  const options = optionsFrom(argv);
  if (options.checkLine) {
    if (!options.target || !options.line) throw new Error("Checking a line needs --target <folder> and --line <name>.");
    new AssemblyLine(options.target, options.line);
    console.log("Assembly line accepted.");
    return;
  }
  if (!options.run) throw new Error("A run needs a name (--run <name>).");
  await startDaemon();
  const reply = await request({ command: "start", options, env: process.env });
  if (!reply.ok) throw new Error(reply.message);
  console.log(reply.message);
}

main(process.argv.slice(2)).catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
