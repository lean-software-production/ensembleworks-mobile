# Tetris 008 completed comparison

All three products completed the same 13 frozen tasks and passed independent factory validation plus external protocol-v2 acceptance. Each received the same three-brain plan review and model profile.

| Assembly line | Reported I/O | Reported cache reads | Commits | Run min |
| --- | ---: | ---: | ---: | ---: |
| implement-reviewed-ralph | ≥ 985,760 | ≥ 3,877,392 | 13 | 62.0 |
| implement-reviewed-one-shot | 337,984 | 1,170,146 | 1 | 14.2 |
| implement-reviewed-batches | 506,045 | 1,665,509 | 3 | 21.0 |

One-shot recorded 33.2% fewer I/O tokens than logical batches in this pilot. Phase breakdowns, cache writes, coverage, call counts and timing segments remain in dataset.json.

Ralph is the original observation resumed after an explicitly recorded interruption, not a replacement trial. Its totals include all reported pre-interruption work and subsequent correction attempts. The interrupted T10 call has unknown usage, so token totals are lower bounds. Run minutes sum invocation spans, including the original stalled span, and exclude the paused interval between invocations; full wall time remains in JSON. The original interrupted result/record is archived in runs/tetris-008-ralph/resume-history/.

These are single sequential observations with independently clarified contracts and differing correction histories. Shared provider cache and fixed order remain confounders. Acceptance does not imply identical implementation or test coverage, and test counts do not establish relative quality. The result supports a presentation of observed costs and trade-offs, not a consistent or causal ranking.

A subsequent [shared code-quality audit](quality-review.md) found different input/terminal robustness gaps in the three accepted outputs, including a delayed-output error shared by all three. These cost figures therefore measure reaching the original acceptance bar, not demonstrated equal robustness or maintainability. The measured products remain preserved.
