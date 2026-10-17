# Tetris 007 combined observations

All attempts retained. Input/output are reported separately from cache reads/writes; absent counters unknown. Active calls are partial. First whole-plan implementation/validation costs are separate from later completion loops. One trial, runner repairs and service interruptions prevent causal efficiency claims. No incomplete game counts as a saving.

# Final observational review — 20261017T232424070866Z

All E00–E04 hypotheses are tested as exploratory observations, not demonstrated optimisations. All five current products finished 13/13 tasks with accepted plan review and independent validator approval. Strict frozen acceptance remains failed for every configuration. This is a completed negative/inconclusive comparison; no requirements are waived and no extra trials are justified by these results.

This check confirmed all five daemons idle and no active supervisors/gates or machines. Old E04 whole-plan-01 remains stopped. E04 whole-plan-02 has exactly one accepted product commit b9d73b9; its immediate planner verified the receipt and finished. E02 finished at 22:58:56 UTC; E04 at 23:02:18 UTC. No provider diagnostic or model call was needed.

Re-evaluation was performed consistently across all five products: final npm test, bounded non-TTY launch, actual npm start PTY arrow/pause/quit input without Enter and exact termios restoration, accepted checkpoint, task-name/completion check, documentation presence and pure render probes covering all seven distinct piece colours. All suites and PTY/render checks passed (E00 111, E01 51, E02 164, E03 65, E04 21 tests). Original acceptance.json outcomes remain untouched; labelled re-evaluations are separate.

The frozen acceptance explicitly requires several ANSI colours in non-interactive output. All accepted product designs intentionally produce plain non-TTY output. The original colour failures are real failures against that literal frozen clause, but do not establish a TTY palette defect. Seven-piece render coverage and TTY launch colour evidence address the appropriate interactive scope. No product was changed to satisfy a mistaken external probe.

E00 additionally renamed task 11 and deferred live raw/Enter-free input support to task 12. Final-product compliance does not repair this frozen parent-name/boundary violation. Its optional rotation/scoring clarifications preserve permitted choices. E01, E03 and E04 retain every frozen task heading and original clause verbatim; E02 retains headings and expands lifecycle wording to require basic raw input in task 11 and hardening in task 12, retaining the original checks. Clause audits are wording evidence; source, validator and documentation review supply the semantic evidence.

README and VERIFICATION review for all five confirms installation/start/test, minimum size, actual keys, scoring, rotation, fixed gravity, and explicit limitations. Final factory validators checked actual-entry controllable falling/locking/clearing/scoring/game-over/restart/quit regressions and real-launch cleanup. External PTY dispatch alone is not proof of the gameplay semantics. E03 uses seeded synthetic integration state; E04 seeds near-clear state and mutates a game-over setup after launch. Those tests cover transitions but do not establish natural play reachability. Their accepted plans permit fixture seams and lack E02’s explicit reachable-fixture contract; do not generalise E02’s stronger evidence to them. No manual visual or cross-platform terminal survey is claimed.

E02 original rejection and malformed JSON-attached-to-prose diagnostic remain preserved. Its doer replaced direct fixture edits with legal gameplay setup (floor I pieces, O stack and I cap), then the independent validator explicitly accepted legal reachability, 164 tests, both colour/q and NO_COLOR/Ctrl-C PTYs, and documentation. The previous failed finding remains in the denominator. Its third resume was an explicit evidence-delivery intervention; attempt budgets restart on resume. It is not an uninterrupted or unsteered comparison.

| Config | Input | Output | I/O | Cache read (coverage) | Cache write (coverage) | Calls | Active min | Resumes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| E00 | 718,988 | 82,517 | 801,505 | 3,110,925 (57/60) | 22,132 (57/60) | 60 | 28.33 | 2 |
| E01 | 649,929 | 81,172 | 731,101 | 2,635,609 (55/58) | 18,719 (55/58) | 58 | 25.87 | 2 |
| E02 | 902,214 | 233,144 | 1,135,358 | 3,930,593 (63/67) | 17,340 (63/67) | 67 | 58.11 | 3 |
| E03 | 495,746 | 67,014 | 562,760 | 1,953,897 (34/54) | 10,071 (34/54) | 54 | 24.73 | 2 |
| E04 | 278,990 | 41,008 | 319,998 | 1,242,199 (18/19) | 17,678 (18/19) | 19 | 10.65 | 0 |

Input/output counters are separate from cache reads/writes; they are the provider-reported non-cache I/O categories, not a dollar estimate. Missing counters are unknown, including E03’s one missing I/O report and local cache fields. combined.json provides per-phase counters/coverage, active and elapsed seconds, recovery and first implementation/validation costs; combined-calls.csv provides each call and attempt. All 22 trial slots remain in the dataset, including earlier failures, provider interruptions and the old E04 loop. No incomplete game is counted as a saving.

Hypothesis observations:
- E00: 16 doer calls, 15 validator calls; reported first-attempt doer input 263,972. Full first-attempt, retry, phase and per-call coverage is retained in the linked raw ledger.
- E01: 15 doer calls, 14 validator calls; reported first-attempt doer input 236,439. Full first-attempt, retry, phase and per-call coverage is retained in the linked raw ledger.
- E02: 18 doer calls, 18 validator calls; reported first-attempt doer input 363,727. Full first-attempt, retry, phase and per-call coverage is retained in the linked raw ledger.
- E03: 16 doer calls, 14 validator calls; reported first-attempt doer input 216,723. Full first-attempt, retry, phase and per-call coverage is retained in the linked raw ledger.
- E04: 3 doer calls, 3 validator calls; reported first-attempt doer input 27,546. Full first-attempt, retry, phase and per-call coverage is retained in the linked raw ledger.

E00 establishes an observed 801,505 I/O baseline with scope drift; it does not establish repeatability. E01 records 731,101 I/O (8.8% lower observed total), with 14 validator calls versus E00’s 15; lower usage is suggestive but the control drift and interruptions prevent the compact-contract causal claim. E02 records 1,135,358 I/O (41.7% higher), including its costly correction and explicit recovery; no observed total saving. E03 records 562,760 I/O (29.8% lower reported total), with 16 local planner calls reporting zero input/output; this supports the mechanical bookkeeping reduction, while one missing implementation usage report, different plan review rounds and scope differences prevent a full-product causal saving claim. E04 records 319,998 I/O (60.1% lower observed total), including all three doer/validator attempts, full plan review and final receipt planner. It finishes in 10.65 active minutes with one commit. It is a repaired, different runner revision with no simultaneous matching E00; no causal claim is warranted. None is eligible under the literal frozen acceptance.

E04 old whole-plan-01 is a retained failed protocol observation, not a resumed baseline. Its first doer input/output 39,638/9,864 and first validator 35,104/8,100 are separate from the repeated-completion loop; entire old observation input/output 812,663/97,106. New E04 first-call costs are separately recorded in combined.json; all retries count toward its total. Shared receipt repair changes context; it cannot be silently treated as the original one-variable comparison.

Validation this check: all five product suites/PTY/palette probes passed except the preserved frozen-colour discrepancy (and E00 frozen task identity); three reporting regressions passed and reporting scripts compile. Factory runner source was unchanged, so no new factory suite was needed; E04 launch retains the passing 126-scenario/1831-step suite and real planner smoke gate. No factory/spec files, products, credentials, providers or model settings were edited.

All five have a completed independently checked observation and this limitations report. Stop the maintenance timer with statuses tested. No further autonomous product corrections or fresh trials are scheduled; any redesigned acceptance or controlled repeat is separate future work.


See results.html and maintenance/combined.json for all retained trials, timing, recovery and usage coverage.
