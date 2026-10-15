# Gameplay and scope

Review the plan against the seed, keeping gameplay assumptions explicit and minimal.
Check that movement, rotation direction and rejection, collision, gravity, locking,
spawning, line clearing, scoring and game over form a coherent playable game.
Check board coordinates, state transitions and invariants, with concrete examples
for walls, floors, occupied cells, blocked spawns and simultaneous clears.
Distinguish choices left open by the seed from requirements it actually makes.
Challenge missing behavior and contradictions; do not require a particular rotation
system, scoring system or additional feature when the chosen rules are coherent.
Check that every seed requirement maps to planned tasks and acceptance examples.

# Responsibility-driven object design

Review planned responsibilities and collaborations through the object-design
traditions of Sandi Metz, Rebecca Wirfs-Brock, David West, Kent Beck, Ward Cunningham
and Smalltalk. These are influences, not a shared fixed checklist.
Check that each decision lives with the collaborator that owns its knowledge.
Look for cohesive responsibilities, narrow intention-revealing messages, clear
ownership and behavioral contracts rather than internal-state exposure.
Check that gameplay, input decoding, display and lifecycle collaborate without
sprawling procedural controllers, type switches or cascading changes.
Favor the simplest useful design, composition and isolated dependencies.
Do not prescribe files, method inventories, class counts, speculative abstractions,
or turn useful functions into classes merely for appearance. Leave coding details
to the doer while ensuring the plan makes its important collaborations testable.

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

# Terminal experience and lifecycle

Check the player's complete experience: launch via npm start, clear controls,
readable board/score, responsive input, feedback, game over and graceful exit.
Require a concrete display row budget within the seed's 24 rows, including borders,
score, controls and game-over messages. Check narrow/short terminals and fallback
messages against actual available dimensions, including a single-row terminal.
Check pause/resume policy on resize and overflow caused by changing score text.
Check raw-mode ownership, cursor visibility, stdin listeners and timer cleanup
on quit, Ctrl+C, game over, startup failure and other planned exit paths.
Check Buffer input, combined keys, split escape sequences and invalid prefixes
cannot swallow quit commands. Challenge ambiguous lifecycle contracts and missing
acceptance examples; do not impose aesthetics or features beyond the seed.
