# Testability and acceptance evidence

Check observable behavior examples, controllable time/randomness and terminal I/O
boundaries. Tasks need commands and expected outcomes, not just "add tests".
Check movement and rotation rejection preserve state; rotation assertions identify
occupied coordinates rather than merely checking a counter. Check board compaction,
multi-line clears and the consequences of the plan's chosen scoring/level rules.
Plan fixtures only for states commands cannot reasonably create, with validated
copies rather than mutable internal-state escape hatches. Tests should exercise
commands and observable outcomes without mirroring implementation details.
Cover split/combined input, gravity with controlled timers, resize transitions,
game-over cancellation and cleanup. Startup evidence must exercise npm start.
Ensure each task can be validated independently and final integration evidence has
a committable report. Do not demand exhaustive coverage or tests for extra features.
