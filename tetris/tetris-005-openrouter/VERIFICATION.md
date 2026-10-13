# Assembly-line verification

Checked on 2026-10-13. This target contains assembly-line configuration for a
fresh build; no game or run plan has been generated yet.

| Check | Outcome |
| --- | --- |
| Public CLI: `bin/factory --check-line --target tetris/tetris-005-openrouter --line careful` from the repository root | Passed: `Assembly line accepted.` |
| Configuration loaded through the factory's `AssemblyLine` and prompt builders | Passed: all three reviewer prompts are identical, the configured models differ, the doer fans out to all three reviewers, and all branches join at the synthesiser. |
| Synthesiser routing through `AssemblyLine.next` | Passed: `satisfied: false` returns to the doer; `satisfied: true` returns to the planner. |
| Live Pi connectivity: `openai-codex/gpt-6.1-sol` | Passed: returned `{"ok":true}`. |
| Live Pi connectivity: `openai-codex/gpt-5.6-terra` | Passed: returned `{"ok":true}` after switching the doer and synthesiser to this model. The public CLI line check also passed after the change. |
| Live Pi connectivity: `openrouter/anthropic/claude-opus-5.5` | Passed: returned `{"ok":true}`. |
| Live Pi connectivity: `openrouter/moonshotai/kimi-k3` | Passed: returned `{"ok":true}`. |
| Factory TypeScript check: `npm run typecheck` from `factory/` | Passed. |
| Iteration 005 homework and fan-out regression suite | Passed: 63 scenarios, 871 steps. Used a temporary Cucumber configuration selecting `spec/features/**/*.feature` and `features/fan-out-regression.feature`, excluding `@real-agent`. |
| Full factory suite: `npm test` from `factory/` | 85 scenarios passed, 1 failed. The failing scenario is `Resuming an accepted plan does not spend another planning review round` in the existing `features/plan-first.feature:67`; on resume the plan reviewers were called twice instead of once. |

Connectivity checks used ephemeral Pi sessions with tools, extensions, MCP,
skills, prompt templates and repository context disabled. They verify model
selection, authentication and JSON replies, rather than a full code review.

The full factory build and `npm run test:real-agent` were not run. Gameplay,
terminal behavior and review quality remain to be checked after generation.

The full-suite failure is in the existing plan-first experiment, which this
iteration 005 line does not use. This setup added only the new target's files;
it did not modify the existing factory implementation or other targets.
