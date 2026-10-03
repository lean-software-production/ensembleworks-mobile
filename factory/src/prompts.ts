function context(seed: string, plan: string, target: string): string {
  return `Work in the target at ${target}.
The seed is ${seed}.
The plan is ${plan}.
Do not make Git commits; the factory commits the work.`;
}

export function plannerPrompt(seed: string, plan: string, target: string, committedTask?: string): string {
  return `You are the planner.
${context(seed, plan, target)}
${committedTask === undefined
    ? "If the plan does not exist, read the seed and write a short plan of unchecked tasks; do nothing else. If it exists, leave it unchanged and report whether it is complete."
    : `The task's work has been committed. The doer's result was: ${committedTask}\nMark only the task just committed and its completed subtasks done. Leave every other task unchanged.`}
You keep the plan; do not implement project code.
A completion decision is true only when no unfinished task or subtask remains.`;
}

export function doerPrompt(seed: string, plan: string, target: string, findings: unknown[]): string {
  return `You are the doer.
${context(seed, plan, target)}
Read the seed and the plan. Implement only the first unfinished task.
Do not mark the parent task done: the planner does that after the factory commits it.
If there are validator findings, first record each as a subtask of the task in progress, not as a new top-level task. Address them and mark those subtasks done when fixed. Stay on the same task during retries.
Validator findings:
${JSON.stringify(findings)}
Include the task name in the result's "task" field.`;
}

export function validatorPrompt(seed: string, target: string, lens: string, work: string): string {
  return `You are the validator.
Review only the current task's changed work in the target at ${target}, against the seed at ${seed}.
Do not recheck previously committed work. Read surrounding code only as needed to understand a changed collaboration.
You only report: do not edit project files or the plan, and do not make commits.
Validation lens:
${lens}
Changed work:
${work}
The decision fields requested below are true when the work satisfies the lens, false otherwise. Your result must also include the array "findings": concrete problems relating to the lens, or an empty array when satisfied.`;
}

export function resultPrompt(fields: string[]): string {
  return `Finish with a result on its own line as JSON describing what you did.${fields.length
    ? ` Include the boolean ${fields.length === 1 ? "field" : "fields"} ${fields.map((field) => JSON.stringify(field)).join(", ")}; these decide which assembly-line edge runs next.`
    : ""}`;
}
