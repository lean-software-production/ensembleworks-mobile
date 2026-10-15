import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { MachineConfig } from "./assembly-line";

export function adapter(machine: MachineConfig): string {
  const kind = machine.adapter ?? basename(machine.harness);
  return ({ "pi-rpc-acp": "pi", "claude-agent-acp": "claude", "codex-acp": "codex" } as Record<string, string>)[kind] ?? kind;
}
export function machineProvider(machine: MachineConfig): string {
  return machine.provider ?? (machine.model?.includes("/") ? machine.model.split("/")[0] : undefined)
    ?? (adapter(machine) === "codex" ? "openai" : ["pi", "claude"].includes(adapter(machine)) ? "anthropic" : "local");
}
function credentials(machine: MachineConfig): { login: string; key: string } | undefined {
  const kind = adapter(machine);
  if (!["pi", "claude", "codex"].includes(kind)) return undefined; // Ordinary code needs no agent login.
  const provider = machineProvider(machine);
  const keys: Record<string, string> = {
    anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY", "openai-codex": "CODEX_API_KEY",
    google: "GEMINI_API_KEY", openrouter: "OPENROUTER_API_KEY"
  };
  return {
    login: join(machine.folder, kind === "claude" ? ".credentials.json" : "auth.json"),
    key: kind === "codex" ? "CODEX_API_KEY" : kind === "claude" ? "ANTHROPIC_API_KEY" : keys[provider] ?? `${provider.toUpperCase().replace(/-/g, "_")}_API_KEY`
  };
}

export function prepareMachines(machines: MachineConfig[], env: NodeJS.ProcessEnv = process.env): void {
  for (const machine of machines) {
    if (adapter(machine) === "agy") throw new Error("Antigravity cannot isolate machine configuration and is unsupported.");
    const auth = credentials(machine);
    if (auth && !existsSync(auth.login) && !env[auth.key]) {
      throw new Error(`The ${machine.name} cannot sign in: copy its login into ${machine.folder} or set ${auth.key}.`);
    }
  }
  for (const machine of machines) {
    const ignore = join(machine.folder, ".gitignore");
    const previous = existsSync(ignore) ? readFileSync(ignore, "utf8") : "";
    const rules = ["auth.json", ".credentials.json", "sessions/", "logs/", "history.jsonl", "models.json"];
    const missing = rules.filter(rule => !previous.split(/\r?\n/).includes(rule));
    if (missing.length) writeFileSync(ignore, previous + (previous.endsWith("\n") || !previous ? "" : "\n") + missing.join("\n") + "\n");
    if (adapter(machine) === "claude") writeFileSync(join(machine.folder, "CLAUDE.md"), "@AGENTS.md\n");
    if (adapter(machine) === "codex") {
      const config = join(machine.folder, "config.toml");
      const previous = existsSync(config) ? readFileSync(config, "utf8") : "";
      // Keep the setting at the TOML root, before any table.
      const cleaned = previous.replace(/^\s*project_doc_max_bytes\s*=.*\n?/gm, "");
      const configured = machine.model ? cleaned.replace(/^model\s*=.*\n?/gm, "") : cleaned;
      writeFileSync(config, `project_doc_max_bytes = 0\n${machine.model ? `model = ${JSON.stringify(machine.model)}\n` : ""}${configured}`);
    }
  }
}

export function harnessInvocation(machine: MachineConfig, parentEnv: NodeJS.ProcessEnv = process.env): { command: string; args: string[]; env: NodeJS.ProcessEnv } {
  const kind = adapter(machine);
  const env = { ...parentEnv };
  // A parent agent's configuration must not leak into its child machines.
  for (const key of ["PI_CODING_AGENT_DIR", "CLAUDE_CONFIG_DIR", "CODEX_HOME"]) delete env[key];
  const auth = credentials(machine);
  if (auth && existsSync(auth.login)) delete env[auth.key];
  const args: string[] = [];
  const command = ({ pi: "pi-rpc-acp", claude: "claude-agent-acp", codex: "codex-acp" } as Record<string, string>)[machine.harness] ?? machine.harness;
  if (machine.model && !["claude", "codex"].includes(kind)) args.push("--model", machine.model);
  if (kind === "pi") {
    env.PI_CODING_AGENT_DIR = machine.folder;
    args.push("--no-session", "--no-context-files", "--append-system-prompt", join(machine.folder, "AGENTS.md"));
  } else if (kind === "claude") {
    env.CLAUDE_CONFIG_DIR = machine.folder;
    // Isolation is supplied in session/new for the Claude ACP adapter.
  } else if (kind === "codex") {
    env.CODEX_HOME = machine.folder;
  }
  return { command, args, env };
}
