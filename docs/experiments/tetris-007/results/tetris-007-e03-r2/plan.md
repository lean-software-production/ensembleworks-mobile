# Terminal Tetris implementation plan

## Requirements and approach

Build a terminal Tetris game in this target, launched with `npm start`. Keep the entire display—including board, borders, score, controls, and game-over text—within 24 terminal rows in every state. Do not commit from the implementation agent; the factory commits changes.

Use a testable game model separate from terminal I/O. Use a conventional 10-column, 20-row playfield and all seven tetrominoes. A practical display budget is 22 rows for the bordered playfield and two status/control rows; replace existing status text for messages rather than appending rows. No particular rotation system, scoring formula, or dependency is mandated: choose simple deterministic rules and document them. Keep the automated test command available as `npm test` (reuse any existing tooling if present).

Every task below must produce a focused committable change in the target, including the automated checks described. Tasks remain unchecked until their changes have been committed.

## Implementation contracts (design, not progress)

These choices resolve the optional rules above without adding gameplay features. Preserve the task checks below; the implementation may choose module names and data structures.

### Model rules and invariants — tasks 2–9

- The board is exactly 20 rows by 10 columns, indexed from the top left. A settled cell is empty or carries one of the seven piece types; active cells are separate. Every running active piece has exactly four distinct, in-bounds cells disjoint from settled cells. No hidden rows, hold, preview, levels, hard drop, or lock delay are required.
- Define the seven familiar tetromino geometries in fixed square local grids: I in 4×4, O in 2×2, the others in 3×3. Document the initial occupied cells (I horizontal, O square, others in their conventional two-row orientations). Spawn at local-grid origin `x = floor((10 - gridWidth) / 2), y = 0`. Padding is not occupied and never causes a collision. Clockwise rotation rotates the entire local grid without moving its origin; O is unchanged. No wall kicks: reject any rotation with an invalid occupied cell. Four rotations restore geometry and origin.
- The placement predicate owns all occupied-cell bounds and settled-cell checks. Rejected movement/rotation and blocked primitive down leave all state unchanged, including the piece source. Primitive down reports moved/blocked only; it never locks. Lock is valid only for a legal active piece that cannot move down; invalid lock requests are rejected without mutation.
- The combined descent action (gravity or soft drop) either moves one row or atomically locks four cells, clears complete rows, awards points, and consumes exactly one next type to attempt spawn. A newly spawned piece never falls in that same action. Compaction preserves surviving row order and cell types and inserts empty rows at the top. Clear count is a transient result of this transaction, not an event that a later redraw/tick can score twice.
- Score starts at zero. Award 0/100/300/500/800 points for 0/1/2/3/4 rows in one lock; no movement/drop bonuses. Detect blocked spawn only after compaction and scoring. On blocked spawn, retain the resulting settled board and score, set game over, and have no active piece; never overlay the obstructed candidate. Initial spawn uses the same validation.
- Use independent uniform selection among seven types, not a required bag. Inject the type source (or seeded random source) so tests can prescribe sequences. Initialization and each next spawn consume one type; renders, rejected actions, pause, and game-over actions consume none. Restart clears board and score, clears pause/game over, and consumes one fresh type from the same source rather than rewinding it. Tests may inject a resettable source explicitly.

### Collaboration boundaries and dependencies

- Task 1 owns the pure renderer and frame measurement contract. Its input is a read-only display snapshot (board, optional active piece, score, phase); its output is a frame, never terminal writes or model mutations. Task 2 supplies typed piece cells; tasks 8–10 supply score/phase. Keep this boundary usable as these fields arrive.
- Tasks 2–5 own geometry, placement, and movement primitives. Task 6 owns the atomic descent/lock/spawn transaction; task 7 supplies compaction and clear count, task 8 consumes that count within the transaction, and task 9 supplies final spawn validation and restart. Intermediate task 6 must expose a blocked-spawn result with no illegal active piece even before the game-over UI exists. Tests must cover clear-before-spawn through this shared transaction, not an independent UI implementation.
- Task 10 owns scheduling and dispatches the same descent action as task 11's soft drop. Task 11 owns incremental byte decoding and action routing, not collision or scoring. Task 12 owns the terminal-effects boundary, resizing, and resource-cleanup contract; task 11 must already acquire raw mode through that boundary and restore the previous mode on Q/Ctrl-C for its playable milestone. Task 12 extends that same lifecycle to idempotent cleanup, signals, failures, and resizing, rather than introducing a second owner. Task 13 verifies these collaborators through the actual entry point. Work follows task order; task 12 depends on renderer, scheduler, and input boundaries, and task 13 depends on all of them. Do not duplicate gameplay logic in adapters.
- All nondeterminism/effects cross explicit replaceable boundaries: piece source, clock/scheduler, input bytes, terminal dimensions/capabilities, output writes, and process termination/signals. Core tests require no real clock or TTY. The entry point must allow the same session composition to receive controlled dependencies for integration tests; do not add user-facing cheat commands or rely on a lucky random game.

### Session, input, and time — tasks 9–12

- Phases are running, paused, and game over. Bind arrows to left/right/clockwise/soft drop, P (case-insensitive) to pause/resume, R to restart only at game over, Q and Ctrl-C to quit. No hard drop. Paused/game-over gameplay keys do nothing; pause cannot leave game over, and R in running/paused does nothing. Quit remains available in every phase. Restart returns to running.
- Gravity interval is fixed at 1000 ms. Each due tick dispatches one descent action. Pause, game over, unsuitable terminal size, and teardown suspend gravity. Resume, restart, or restoration of suitable size begins a fresh interval; no elapsed-time catch-up or duplicate scheduling. A resize suspension is separate from user pause, so resizing back does not unpause a user-paused game. Rendering and input actions never reset the pending gravity deadline: this includes accepted movement, rotation, soft drop, and a soft drop that locks/spawns. Only the resume/restart/size-restoration transitions above begin a fresh interval. Serialize input/ticks so each action finishes before the next. Task 10 fake-clock checks must distinguish these policies: after an action at 900 ms, the tick still occurs at 1000 ms (including descent of a piece just spawned by soft drop), not 1900 ms.
- Input decoding preserves partial escape sequences between chunks and emits ordered actions for multiple keys in one chunk. For example, ESC then `[D` is one left action; `left + right + down` in a single chunk emits three actions. Unknown/unsupported escape sequences are discarded as sequences, not interpreted as P/R/Q embedded inside them. Incomplete sequences cause no model change and are discarded at teardown.
- Session setup/teardown owns exactly its acquired raw-mode changes, cursor state, listeners, and timer. Quit, Ctrl-C/process interruption, and handled startup/write/runtime failures share idempotent cleanup before exit; restore previous raw mode, show the cursor if hidden, remove owned listeners, and cancel scheduled work. Inject a failing output write to check cleanup even when further rendering fails. No render may occur after teardown.

### Display and observable boundaries — tasks 1, 8–13

- Use 22 rows for the board including top/bottom borders, plus two rows for status/controls: at most 24 total in running, paused, and game over. Replace status text rather than appending messages. Seven distinct retro ANSI piece colours and styled border/status are required; cell glyphs keep plain/ANSI-stripped output understandable. Every frame resets styles, and plain/non-colour rendering contains no stray escape styling.
- Support terminals at least 61 columns × 24 rows; frames use at most 60 visible columns (board cells may be two columns wide). Keep status/controls concise and document the minimum. For example, split `Score: … | Running/Paused/Game over` and `Arrows: move/rotate/drop  P:pause  R:restart  Q:quit` across the two reserved rows. Abbreviate very large score text to fit without changing the model score. Avoid wrapping, a trailing newline that advances past row 24, and writing the bottom-right terminal cell.
- Measure visible rows and columns after removing ANSI controls, including trailing-newline effects. The terminal adapter owns cursor positioning and in-place replacement, not the pure renderer. Repeated draws must not append frame-sized output below the previous frame. Select interactive mode only when both stdin and stdout are TTYs; otherwise emit exactly one plain, ANSI-free bounded readable snapshot and exit successfully without raw mode, listeners, or timers, regardless of reported dimensions. Snapshot mode need not be playable. Enable ANSI colours only in interactive mode; its size warning remains ASCII. Task 12 must separately test redirected stdin with TTY stdout and TTY stdin with redirected stdout: each produces the plain snapshot, exits with status 0, and acquires no interactive resources.
- On a too-small TTY, suspend play and replace the game with a clipped ASCII size warning within the available rows/columns (leave the last column unused to avoid wrapping). For zero/unknown usable dimensions, emit no frame and wait for valid dimensions or quit. Retain model state while suspended; a valid resize restores a full frame. During size suspension, only Q/Ctrl-C are honored; discard arrows, P, R, and other keys without changing the model, user-pause state, or source, and do not replay them on restoration. This also applies to zero/unknown dimensions. Task 12 resize checks must verify discarded gameplay/pause/restart input and successful quit, in addition to testing 61×24, 60×24, 61×23, and very narrow/one-row cases, including transitions while paused and game over.
- Integration uses deterministic source/clock and a valid near-complete board fixture supplied through the session test seam to reach a clear and blocked spawn without manual luck. Exercise the actual entry-point/session wiring, not a replacement reducer; assert score, phase, no overlapping spawn, restart, and resource cleanup alongside every frame's bounds. Separately smoke-test the actual `npm start` command in a PTY (or honestly record the unavailable environment as a limitation); retain the required automated regression and resolve actual requirement failures.

## Preparation notes (not completion)

- Round 1: retained all 13 task identities, checks, and unchecked states. Added shared contracts for model rules, ownership/dependencies, deterministic test seams, session lifecycle, and bounded rendering; no implementation performed.
- Round 2: addressed terminal-ownership, terminal-mode-selection, and timing-and-suspension findings. Clarified task 11's raw-mode acquisition/restoration through task 12's boundary (scripted input without Enter and Q/Ctrl-C restoration must be checked at task 11); specified both-TTY interactive/colour selection with separate redirection checks at task 12; specified retained action deadlines and quit-only size suspension with fake-clock/resize checks at tasks 10/12. All task identities, existing checks, and unchecked states preserved; no implementation performed.

## Tasks

- [ ] 1. Deliver a runnable, bounded terminal board display.
  - Inspect the target and adapt existing project conventions rather than overwriting unrelated work. Configure `npm start` to render an empty 10×20 board with borders, score, and concise controls.
  - Extract rendering into a pure function and configure an automated test command.
  - Acceptance/automated checks: starting from the target succeeds; the rendered frame contains all 20 board rows, borders, score, and controls; counting visible rows (including handling trailing newlines) never exceeds 24. Capture output without needing an interactive terminal.

- [ ] 2. Introduce tetromino definitions and initial piece generation.
  - Add all seven tetrominoes, initial board state, active-piece coordinates, and a random piece source that can be seeded or injected for tests. Spawn the initial piece in a valid centered position and render it distinctly from empty cells.
  - Acceptance/automated checks: each shape has exactly four distinct cells; every piece initially fits an empty board; deterministic generation exercises all seven types; active-piece rendering remains within the frame budget.

- [ ] 3. Implement collision-safe horizontal movement.
  - Add left/right model actions with a shared placement/collision predicate. Keep settled cells and the active piece separate.
  - Acceptance/automated checks: unobstructed movement changes position by one column; walls and settled cells reject movement without changing state; repeat movement cannot escape either wall; an active piece does not collide with itself.

- [ ] 4. Implement deterministic rotation.
  - Add clockwise rotation using a documented rule, with invalid rotations rejected (wall kicks are optional, not required). Handle the square piece consistently.
  - Acceptance/automated checks: legal rotation preserves four cells; a complete rotation cycle restores geometry; wall, floor, and settled-cell collisions cannot create overlap or out-of-bounds cells; rejected rotations preserve the original state.

- [ ] 5. Implement downward movement without locking.
  - Add a one-row downward action that reports whether movement was blocked, without merging cells or spawning pieces. This primitive will support timed falling and soft drop.
  - Acceptance/automated checks: a legal step moves exactly one row; floor and settled cells block the step; repeated steps stop at the first obstruction and leave the board unchanged.

- [ ] 6. Implement piece locking and next-piece progression.
  - Add a separate lock operation and a game action that locks when a downward attempt is blocked, then creates the next active piece. Keep blocked-spawn handling explicit for the later game-over task rather than allowing overlaps.
  - Acceptance/automated checks: locking copies exactly four cells into the board without altering unrelated cells; a successful downward move does not lock; a blocked move locks once and consumes exactly one next piece; the next piece is not advanced by the same action that spawned it.

- [ ] 7. Implement completed-line clearing and board compaction.
  - Clear full rows after locking and before next-piece placement; return the number of cleared rows as an event/result for scoring.
  - Acceptance/automated checks: zero, one, two, three, and four simultaneous clears; nonadjacent full rows clear correctly; remaining rows retain their relative order; empty rows are inserted at the top; board dimensions stay 10×20. Include an end-to-end lock-that-completes-a-row case.

- [ ] 8. Implement scoring and its display.
  - Choose and document a simple points table for cleared lines, initialize score to zero, and update score exactly once per lock/clear result. Render the live score in the reserved status area.
  - Acceptance/automated checks: verify each supported clear count, accumulation across multiple clears, and no points for ordinary movement, failed movement, rotation, or zero-line locks. Large scores must not add display rows.

- [ ] 9. Implement game-over detection and restart.
  - Detect an obstructed next spawn after line clearing, transition to a game-over state without overwriting settled cells, and show the message in existing display rows. Add restart that creates a fresh playable state.
  - Acceptance/automated checks: blocked spawn ends the game; an unblocked spawn continues; a clear that opens spawn space is processed before the decision; movement/rotation/drop actions after game over do not mutate the board or score; restart resets board, score, active piece, and game-over status. Both running and game-over frames stay within 24 rows and expose the relevant controls.

- [ ] 10. Add timed gravity and pause behavior.
  - Introduce a controllable scheduler that drives the existing downward/lock action at a documented fixed interval. Add pause/resume and display its state using the existing status rows.
  - Acceptance/automated checks with a fake clock: no fall before the interval; one expected action per tick; grounded pieces lock and progress; pause and game over stop advancement; resume/restart do not accumulate duplicate timers or catch-up falls; all displayed states remain bounded.

- [ ] 11. Connect keyboard controls to the playable terminal session.
  - Wire left/right arrows, up-arrow rotation, down-arrow soft drop, pause/resume, restart after game over, and quit; advertise the actual bindings within the display. Process input without requiring Enter in an interactive terminal.
  - Keep input decoding testable and handle unknown keys safely. If an additional hard-drop control is offered, implement and test it explicitly rather than implying support.
  - Acceptance/automated checks: feed real key byte sequences through the input adapter and verify the corresponding model actions, including multiple keys in a chunk and arrow sequences split across chunks; unknown keys cause no state change; a scripted terminal session can move, rotate, descend, pause, resume, and restart. Controls and status still occupy no more than the allocated rows.

- [ ] 12. Make terminal redraw and session teardown reliable.
  - Redraw in place instead of scrolling frames; manage raw mode, cursor visibility, input listeners, and timers for the session lifetime. Restore terminal state on quit, interruption, and handled failures. Define safe behavior for non-TTY input and terminals too small for the board, without crashing or printing an oversized frame.
  - Acceptance/automated checks with terminal/process fakes or a PTY: repeated frames replace rather than append; quit and interruption restore raw mode/cursor and remove listeners/timers; cleanup is idempotent; narrow/short-terminal warnings fit the available display; returning to a suitable size can render the bounded game frame; non-TTY startup exits or produces bounded output without hanging.

- [ ] 13. Verify and document the complete launch-to-exit experience.
  - Add concise project documentation for installation, `npm start`, `npm test`, supported terminal size, bindings, scoring, rotation, and fixed gravity behavior.
  - Add an automated integration regression that launches the actual entry point with controlled terminal I/O, exercises falling, locking, a line clear and score update, game over, restart, and quit, and checks that every emitted frame stays within 24 rows.
  - Deliver a verification report in the target recording commands performed and results, including the complete automated suite and an interactive or PTY smoke test of the actual launch command. Record any limitations honestly and resolve requirement failures before declaring completion.
  - Acceptance: `npm test` passes; `npm start` starts the playable terminal game; all required information is visible without scrolling past 24 rows in running, paused, and game-over states; exit leaves the terminal usable.

## Completion rule

The plan is complete only when every task and subtask above has been delivered and committed, with no unchecked task remaining. Verification alone does not complete missing implementation work.
