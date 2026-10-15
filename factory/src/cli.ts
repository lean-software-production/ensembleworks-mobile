import { optionsFrom } from "./options";
import { runFactory } from "./runner";
import { RunRecord, watch } from "./record";
import { command, ensureDaemon, serve } from "./daemon";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === "--daemon") { serve(); return; }
  if (args[0] === "watch") {
    if (args.length !== 2) throw new Error("Usage: factory watch <run>");
    const status = await watch(args[1]);
    if (status === "failed") process.exitCode = 1;
    return;
  }
  if (args[0] === "stop" || args[0] === "status") {
    if (args.length > (args[0] === "stop" ? 2 : 1)) throw new Error(`Usage: factory ${args[0]}`);
    try {
      const response = await command(args[0], { name: args[1] });
      console.log(response.message ?? JSON.stringify(response));
    } catch (error) {
      if (["ENOENT", "ECONNREFUSED"].includes((error as NodeJS.ErrnoException).code ?? "")) {
        console.log(args[0] === "status" ? JSON.stringify({ running: false, run: null }) : "factory stopped");
      } else throw error;
    }
    return;
  }
  const options = optionsFrom(args);
  if (options.checkLine) {
    await runFactory(options, new RunRecord("check-line"), new AbortController().signal);
    return;
  }
  // Validate the name before starting a daemon or writing any run state.
  new RunRecord(options.run);
  await ensureDaemon();
  console.log((await command("start", options)).message);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
