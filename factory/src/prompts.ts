// Machine instructions live in the target's AGENTS.md. Substitute run data once;
// inserted data is never interpreted as a template.
export function machinePrompt(instructions: string, data: Record<string, string>): string {
  const selected = instructions.replace(/\{\{([#^])(\w+)\}\}([\s\S]*?)\{\{\/\2\}\}/g,
    (_match, mode, key, body) => Boolean(data[key]) === (mode === "#") ? body : "");
  return selected.replace(/\{\{(\w+)\}\}/g, (_match, key) => data[key] ?? "");
}

export function resultPrompt(fields: string[]): string {
  return `Finish with a result: a single line of JSON describing what you did. That last line must be the JSON object alone, with no label such as "result:" before it and no code fence around it.${fields.length
    ? ` Include the boolean ${fields.length === 1 ? "field" : "fields"} ${fields.map((field) => JSON.stringify(field)).join(", ")}; these decide which assembly-line edge runs next.`
    : ""}`;
}
