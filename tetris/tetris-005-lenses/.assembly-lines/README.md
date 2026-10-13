# Tetris 005: three review lenses

A fresh build from `tetris/spec.md`, using the same `careful` fan-out line as
`tetris-005-openrouter`. No generated game files or completed plan are copied.

| Machine | Model | Review lens |
| --- | --- | --- |
| planner | openai-codex/gpt-6.1-sol | — |
| doer | openai-codex/gpt-5.6-terra | — |
| reviewer_1 | openai-codex/gpt-6.1-sol | Responsibility-driven OO design |
| reviewer_2 | openai-codex/gpt-6.1-sol | Testability |
| reviewer_3 | openai-codex/gpt-6.1-sol | Terminal UX |
| synthesiser | openai-codex/gpt-5.6-terra | Reconcile the three reports |

Reviewers use the same model so their instructions differ by lens. They run
concurrently over the same current-task diff. The synthesiser decides which
findings require revisions; acceptance commits the task before planner progress.

From the repository root:

```sh
bin/factory --check-line --target tetris/tetris-005-lenses --line careful
bin/factory --run tetris-005-lenses --target tetris/tetris-005-lenses --line careful --seed tetris/spec.md
```

Resume with `bin/factory --run tetris-005-lenses`. Its plan and logs live in
`factory/runs/tetris-005-lenses/`. Once generated, play with
`npm --prefix tetris/tetris-005-lenses start` and test with
`npm --prefix tetris/tetris-005-lenses test`.
