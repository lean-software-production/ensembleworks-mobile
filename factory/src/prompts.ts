// Machine instructions live in the target's AGENTS.md. Substitute run data once;
// inserted data is never interpreted as a template.
export function machinePrompt(instructions: string, data: Record<string, string>): string {
  const selected = instructions.replace(/\{\{([#^])(\w+)\}\}([\s\S]*?)\{\{\/\2\}\}/g,
    (_match, mode, key, body) => Boolean(data[key]) === (mode === "#") ? body : "");
  return selected.replace(/\{\{(\w+)\}\}/g, (_match, key) => data[key] ?? "");
}

const resultContracts: Record<string, string> = {
  plan_author: 'Include "changes": a nonempty string describing the plan revisions.',
  plan_reviewer: 'Include "summary" (string) and "findings" (array, empty when there are none). Each finding needs a nonempty stable "id" and "issue", plus the section, severity and recommendation required by your instructions. Shape: {"summary":"...","findings":[]}. Keep these fields in the final result itself.',
  plan_synthesiser: 'Include "satisfied" (boolean), "findings" (array of required revisions), and "dispositions" (array). Disposition every reviewer finding with "reviewer", "id", "status" (resolved, rejected, accepted_limitation or revise), and a nonempty "reason". When satisfied, findings must be empty and no disposition may request revise.',
  plan_validator: 'Include "satisfied", "retry" and "replan" (booleans, exactly one true), plus "findings" (array) and the checks required by your instructions. Satisfied requires empty findings; retry or replan requires actionable findings.'
};

export function resultPrompt(fields: string[], role = ""): string {
  return `Finish with a result: a single line of JSON matching the machine result contract in your instructions. Emit exactly one result object, on the final line, with no label or code fence. Include all required report fields in that same final object; do not append a second JSON acknowledgement, status, or completion summary.${resultContracts[role] ? ` ${resultContracts[role]}` : ""}${fields.length
    ? ` Include the boolean ${fields.length === 1 ? "field" : "fields"} ${fields.map((field) => JSON.stringify(field)).join(", ")}; these decide which assembly-line edge runs next.`
    : ""}`;
}
