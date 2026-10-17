# Tetris 007: completed-run analysis

Both runs completed all 13 tasks. **007 used 927,736 recorded input/output tokens,
132.1% more than 006's 399,747.** The changes bought additional review and concrete
defect detection, but did not demonstrate an overall token-efficiency improvement.

This is a comparison of recorded input/output usage, not complete token consumption
or monetary cost. Separate cached-read/write counters are missing. Models, thinking
levels, requirements and validation coverage also changed.

## Evidence and scope

- [006 record](../factory/runs/tetris-006/record.jsonl) and [plan](../factory/runs/tetris-006/plan.md).
- [007 record](../factory/runs/tetris-007/record.jsonl), [plan](../factory/runs/tetris-007/plan.md),
  [review checkpoint](../factory/runs/tetris-007/plan-review.json), and
  [verification report](../tetris/tetris-007/VERIFICATION.md).
- [Assembly line](../tetris/tetris-007/.assembly-lines/efficient.dot), frozen before
  execution at tag `tetris-007-before-run` / commit `76f1171`.
- [Per-task CSV](tetris-007-task-usage.csv), including first and extra attempts.

007 ran on 17 October 2026, from 17:34:03 to 18:11:44 Europe/Dublin (UTC+01:00),
including its recovery gap. The current factory daemon is idle; the run finished.
The records remain in the ignored runtime directory; archive that directory before
resetting the run. This report and CSV preserve the numerical findings separately.

## Overall result

| Metric | 006 | 007 |
| --- | ---: | ---: |
| Completed tasks | 13/13 | 13/13 |
| Machine calls | 31 | 63 |
| Calls using models | 31 | 61 |
| Recorded input | 345,294 | 831,694 |
| Recorded output | 54,453 | 96,042 |
| Recorded I/O total | 399,747 | 927,736 |
| Run segments | 3 | 2 |
| Malformed/unreadable-result stops | 2 | 1 |
| Time with the run active | 21m 15s | 36m 07s |
| Start-to-finish elapsed time | 38m 19s | 37m 41s |

007's elapsed time was slightly shorter because 006 had longer gaps between
resumptions. Its active execution time was about 70% longer. Elapsed time alone
would give a misleading impression of compute efficiency.

| Machine group | 006 recorded I/O | 007 recorded I/O | Change |
| --- | ---: | ---: | --- |
| Doer | 313,958 | 413,741 | +31.8% |
| Planner | 85,789 | 86,505 | +0.8% |
| Implementation validator | — | 352,452 | Added in 007 |
| Plan author + three reviewers + synthesis | — | 75,038 | Added in 007 |
| Local plan checkpoint | — | 0 | Two local calls |
| **Total** | **399,747** | **927,736** | **+132.1%** |

The validator accounts for 38.0% of 007's recorded I/O; plan review accounts for
8.1%. Even excluding both new review categories, planner + doer totalled 500,246
versus 399,747 in 006, an increase of 25.1%. This does not isolate the effect of
instructions: the doer model changed and it implemented stronger contracts.

## Task-by-task implementation and validation

Numbers in parentheses are call counts. All attempts are included, including
failed calls and recovery. The validator column is additional work absent in 006.

| Task | 006 doer tokens (calls) | 007 doer tokens (calls) | 007 validator tokens (calls) |
| --- | ---: | ---: | ---: |
| 1 | 13,063 (1) | 25,326 (1) | 14,385 (1) |
| 2 | 36,165 (2) | 27,132 (1) | 18,781 (1) |
| 3 | 17,404 (1) | 20,875 (1) | 16,287 (1) |
| 4 | 16,174 (2) | 20,788 (1) | 16,246 (1) |
| 5 | 14,723 (1) | 17,106 (1) | 15,157 (1) |
| 6 | 19,284 (1) | 18,011 (1) | 17,328 (1) |
| 7 | 20,378 (1) | 16,553 (1) | 17,940 (1) |
| 8 | 23,859 (1) | 19,065 (1) | 18,341 (1) |
| 9 | 29,018 (1) | 20,196 (1) | 18,873 (1) |
| 10 | 26,280 (1) | 23,570 (1) | 19,358 (1) |
| 11 | 24,917 (1) | 66,037 (3) | 57,991 (3) |
| 12 | 34,293 (1) | 96,096 (4) | 98,810 (4) |
| 13 | 38,400 (1) | 42,986 (1) | 22,955 (1) |

Tasks 6–10 used 97,395 doer tokens versus 118,819 in 006: **18.0% fewer** across
that middle section. That is encouraging, but the full task table shows why it
cannot establish overall savings or prove the handoff caused the reduction.

Tasks 11–12 dominated: doer + validator used 318,934 tokens, 34.4% of the entire
007 run. The additional doer attempts cost 91,521; additional validation attempts
cost 113,157. Together with the 3,277-token resume planner check, repeated-attempt
and recovery overhead was 207,955 recorded tokens (22.4% of the run), relative to
one doer and one validation call per task. These calls include useful corrective
work and are not a measurement of waste.

## What the review actually achieved

Initial plan review took two rounds and 75,038 recorded tokens. Opus identified
four ambiguities; synthesis required revisions despite their suggestion severity:

1. The gravity deadline after a manual lock/spawn.
2. Stale screen content on resize and terminal presentation on exit.
3. The deterministic production integration seam versus actual PTY launch checks.
4. No-kicks rotation wording and per-piece spawn-rotation expectations.

The second round accepted the clarified plan. Astra and Gemini returned no
findings in round 1, and all reviewers accepted the revision in round 2. This
one run does not establish which reviewer could safely be removed in general.
There was no later plan-repair episode.

Implementation validation rejected four attempts with five findings:

- Task 11: unsupported escape/control-string payloads dispatched gameplay keys.
- Task 11 retry: SOS payloads still dispatched pause/quit/restart.
- Task 12: shorter status/control text left stale characters on screen.
- Task 12: output error handling was removed before restoration writes completed.
- Task 12 retry: delayed stream destruction still caused an uncaught error.

These were concrete reproductions, including defects present despite passing
existing tests. They demonstrate value from independent checking. They do not
prove that 006 contains the same bugs or that all validator spending was necessary.

## Which efficiency measures worked?

**Compact handoff: adopted, savings unproven.** Every task commit updated
`HANDOFF.md`. Twelve of the thirteen committed versions were within 250 words;
task 11 reached 273. The notes contain actionable locations, recipes and pitfalls,
and the resumed doer verified existing task-12 work rather than rewriting it.
The record contains generated text, not full tool transcripts, so it cannot prove
which notes each machine read or assign a token saving to selective reading.

**Focused task execution and concise output: visible in the results.** Doer
results consistently identify the task, checks and limitations. The doer's total
recorded output was slightly lower: 48,678 versus 49,623. Its input grew from
264,335 to 365,063, so concise output did not translate into lower total usage.
Output-token semantics also depend on the provider, including reasoning usage.

**Narrow planner updates: no demonstrated saving.** Total planner usage was
nearly unchanged despite one fewer call. The thirteen post-commit updates used
78,653 versus 68,112 tokens: **15.5% more**. Some summaries explicitly describe
rechecking verification evidence and reading the handoff. The cheaper target is
bookkeeping itself, not merely a shorter final JSON response.

**Smaller context: the requirements expanded substantially.** The plan grew from
9,128 to 20,762 bytes. The global material before the task list grew from 1,045
to 11,933 bytes, and doer instructions from 1,042 to 3,040 bytes. The doer is
instructed to read global contracts on each fresh call. The runner also supplies
machine instructions both as Pi's appended system prompt and in its user prompt.
These are plausible counterweights to selective task reading; the record does
not quantify the exact cost of each read or duplicated instruction.

**Checkpoint and recovery: demonstrated.** On resume, the local gate returned
`ready:true`, so the accepted plan was reused without rerunning author/reviewers.
The doer recovered the existing task-12 implementation, verified it, and produced
an honest report. Product work was retained and the task stayed unfinished until
successful validation and commitment.

## The remaining result-boundary failure

The third task-12 validator attempt spent 24,376 recorded tokens and appeared to
report success, but its JSON ended inside the checks array without closing `]}`.
The factory correctly refused to treat the incomplete response as acceptance and
stopped with `Could not read the validator's result.` The record does not identify
why the response ended early. This differs from 006's glued prose/JSON boundary.

Recovery then required a planner check (3,277), doer verification/report (18,534)
and another validator check (25,062): **46,873 additional recorded tokens** before
normal task-12 completion bookkeeping. The failed call itself included useful
checks and should not all be labelled wasted. The existing newline fix and concise
result instructions do not guarantee a complete structured response.

## Completed product evidence

The saved final report records 126 passing tests, a deterministic full-game
production-composition regression, a bounded non-TTY launch, and an actual
`npm start` PTY smoke test covering raw input, movement, quit and terminal-state
restoration. These are broader checks than 006's recorded 41 tests, but test counts
alone are not a quality score.

For this analysis I independently reran `npm test`: **126 passed, 0 failed**.
I also reran the Node entry point with non-TTY output: exit 0, exactly 24 rows,
at most 35 visible columns, no trailing newline, and ANSI colour sequences.
The actual PTY outcomes above are from the saved doer/validator evidence; this
analysis did not repeat that PTY smoke test or perform human gameplay review.

One acknowledged steering delivery requested retro colours. The author put it
into plan revision 2, all reviewers accepted it, and the final renderer uses ANSI
colours. This added presentation scope and is part of the comparison's confounding.

## Next experiment

1. **Fix measurement first.** Save cached-read/write counters and final response
   diagnostics. Opus's two reviews report only 14 input tokens here; treating
   that as its full prompt consumption would be misleading. Preserve model and
   thinking configuration alongside each run.
2. **Compress repeated contracts and remove instruction duplication.** Keep a
   short always-read contract and current-task requirements, retaining detailed
   acceptance examples without repeating them in every orientation step.
3. **Make completion bookkeeping deterministic.** Consider an ordinary ACP
   planner machine that checks the exact committed task identity and updates
   checkboxes, while retaining the model-based author for design. The factory
   itself should continue to avoid reading the plan.
4. **Keep evidence-based validation; test cheaper routing deliberately.** Try a
   stronger doer only for complex input/terminal tasks, or escalate model effort
   after a concrete failed attempt. Low-thinking implementation plus repeated
   high-thinking validation was expensive on tasks 11–12, but this single run
   cannot establish which alternative will be cheaper or equally effective.
5. **Handle incomplete results explicitly.** Preserve useful work and require a
   complete reissued result or deliberate revalidation; do not silently accept
   truncated JSON or rerun whole task implementations just to recover formatting.

Change one variable at a time, keep the same tasks/contracts, and compare
first-attempt implementation, correction loops, validation, planning, transport
recovery and product evidence separately. The current conclusion is stronger
quality checking with higher recorded token use; handoff and context changes
remain promising practices rather than proven net savings.
