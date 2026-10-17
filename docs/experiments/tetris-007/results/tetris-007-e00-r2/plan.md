# Terminal Tetris implementation plan

## Requirements and approach

Build a terminal Tetris game in this target, launched with `npm start`. Keep the entire display—including board, borders, score, controls, and game-over text—within 24 terminal rows in every state. Do not commit from the implementation agent; the factory commits changes.

Use a testable game model separate from terminal I/O. Use a conventional 10-column, 20-row playfield and all seven tetrominoes. A practical display budget is 22 rows for the bordered playfield and two status/control rows; replace existing status text for messages rather than appending rows. Use the minimal gameplay and collaboration contracts below; dependency and internal implementation choices remain with the implementer. Keep the automated test command available as `npm test` (reuse any existing tooling if present).

Every task below must produce a focused committable change in the target, including the automated checks described. Tasks remain unchecked until their changes have been committed.

## Implementation contracts (design, not progress)

### Ownership and dependencies

- The model owns board, active piece, score, phase (`running`, `paused`, `game-over`), collision, and transitions; it never reads keys, clocks, terminal dimensions, or process globals. Rendering consumes a snapshot and explicit display options, returns a frame, and never changes the model. The input adapter emits semantic actions; the session owns time, input buffering, output, resize policy, and cleanup. Keep these boundaries testable without prescribing files or function names.
- Task 1 establishes renderer/test seams; task 2 supplies shapes, state, and piece-source input. Tasks 3–5 share the same placement predicate. Task 6 composes downward movement, locking, and spawning; task 7 inserts clearing between lock and spawn and returns a clear count; task 8 consumes that result once; task 9 completes blocked-spawn and restart handling. Task 10 consumes the resulting model action and provides scheduler controls to task 11. Task 11 connects decoded actions to model/session and must already restore any raw mode/cursor changes on its supported quit and Ctrl-C paths, cancel gravity, and detach its input handlers; test both exits in that increment. Task 12 broadens this minimum safe teardown into idempotent lifecycle coverage for signals, failures, partial initialization, resize and non-TTY use (including the safe startup path needed by task 1). Task 13 verifies the integrated entry point, not a second game implementation. These are handoff dependencies, not permission to omit an earlier task's checks.
- State snapshots and transition outcomes must expose enough information for tests to distinguish moved, blocked, locked/cleared, and blocked-spawn outcomes. A primitive downward step reports blocked without locking; the gameplay downward action composes that primitive with lock/clear/score/spawn. Before task 9, blocked spawn must already leave no overlapping active piece and report failure explicitly.

### Minimal gameplay rules and invariants

- Board coordinates are x=0…9, y=0…19, increasing downward. Settled cells hold a tetromino type or empty; the active piece is separate. Every active cell is distinct, in bounds, and not settled. No hidden rows, negative-y spawn cells, lock delay, hard drop, levels, previews, or wall kicks are required. Invalid actions preserve state and do not consume randomness.
- Use conventional spawn shapes: I horizontal, O square, T with centered protrusion above a three-cell base, J/L with left/right protrusion above that base, S/Z with their conventional staggered two-row forms. Represent rotation in fixed square local bounds (I: 4×4, O: 2×2, others: 3×3); spawn nonempty cells at the top, with the local square horizontally centered using floor((10-size)/2). Clockwise rotation is a quarter turn of those bounds, rejected wholesale if placement fails; O is a no-op. Four turns restore coordinates. Document exact spawn geometry in the implementation tests; do not trim/recenter bounds between rotations.
- Default selection is independent uniform sampling of the seven types (no bag required). Supply a replaceable piece source so a finite known sequence can drive tests; normal play must have an unending source. Initial creation and each post-lock spawn consume exactly one type. Restart clears the board/score/phase and consumes one fresh type from the existing source; it need not rewind a seed. Test-source exhaustion is an explicit harness error, never a silently substituted random piece.
- A gravity or soft-drop action moves one row if possible; otherwise it locks once, clears all full rows simultaneously, adds points once, and attempts exactly one spawn. The new piece never falls in that same action. Compaction retains surviving rows in order and inserts empty rows above. Score table for 0/1/2/3/4 lines is 0/100/300/500/800; no other action awards points. Numeric score presentation must remain single-line even at large values (abbreviate if necessary).
- Spawn collision is evaluated after clearing; on collision retain the settled board, set game-over, and expose no active piece. Game-over movement, rotation, gravity and pause are no-ops. Restart is available only at game over and returns to running; elsewhere it is ignored. Paused movement/rotation/drop are no-ops; pause toggles only running/paused. Quit works in every session state.

### Time, input, display, and lifecycle boundaries

- Gravity interval is fixed at 500 ms. Inject scheduler/time operations; no real sleeps in unit tests. On pause, game over, resize suspension, restart, or exit, cancel pending gravity. Resume, valid-size recovery, and restart begin a fresh full interval, never catch up or multiply timers. Soft drop does not reset the existing gravity deadline. At an exact boundary, process events in delivery order; one delivered tick causes at most one gameplay downward action.
- Bind Left/Right to horizontal movement, Up to clockwise rotation, Down to soft drop, P/p to pause/resume, R/r to restart, Q/q to quit; Ctrl-C uses the interruption cleanup path. Decode actual arrow escape sequences incrementally across chunks and multiple actions per chunk. Unknown bytes or complete unknown escape sequences produce no model action; discard unsupported sequences as units rather than reinterpreting their bytes as letter commands. A partial sequence causes no action until completed and is discarded on cleanup; no standalone Escape binding is required.
- Use 20 board rows plus top/bottom borders (22 rows), then one status and one controls row, totaling at most 24. Two visible columns per board cell permit the board itself to be 22 columns; status/control text may use up to 64 columns. Require a terminal of at least 65 columns by 24 rows, reserving a spare column to avoid right-edge wrapping. Keep all frame lines at most 64 visible columns and omit the final newline. Status replaces itself for pause/game-over, never adds a message row. Advertise all bindings concisely within these rows, including restart when relevant.
- Distinguish all seven types with retro ANSI colors; style borders/status and reset styles at boundaries and on cleanup. Provide explicit plain rendering (also used for non-TTY capture); symbols distinguish pieces and empty cells without color. ANSI/control sequences do not count as visible columns. Frame tests must count actual visible rows including trailing-newline effects and assert width as well as height.
- The session alone redraws in place using cursor positioning/clearing, not appended newline-separated frames; first and repeated frames must not scroll, including at exactly 24 terminal rows. Terminal operations, dimensions, key input, signals, and output writes are replaceable by fakes or a PTY. With non-TTY input or output, emit at most one plain bounded frame and exit without raw mode, listeners, or live timers; this is the task-1 capture path and task-12 final policy.
- Too-small terminals suspend gameplay time and show a clipped single-line size warning within available rows/columns, without wrapping or a trailing newline; if no usable cells exist, emit no text. While suspended, only quit and Ctrl-C/interruption have effect: discard all other decoded actions, including pause and restart, without applying or queuing them. Resize recovery preserves board/score/phase and redraws the normal frame, resuming gravity only if running. Quit and interruption remain available while suspended. Restore only terminal modes actually changed, remove owned listeners, cancel timers, and reset styles/show the cursor on quit, handled signal, input end, or handled initialization/runtime I/O failure. Cleanup is idempotent, including partial initialization; an already-failed output stream may make restoration best-effort rather than guaranteed.

### Observable boundaries and verification handoffs

- Model examples: a piece flush to x=0 rejects Left unchanged; a blocked primitive descent leaves both board and source untouched; a blocked gameplay descent locks four cells and consumes one new type; rows cleared below the spawn area can make a previously obstructed spawn legal. Paused/game-over repeated ticks and keys cannot accumulate deferred movement or points.
- Timer example: at 499 ms no fall, at 500 ms one action; pausing at 499 ms then resuming requires another full 500 ms. Resize suspension follows the same rule. Input example: chunks `ESC [` then `D` yield exactly one Left; a chunk containing two complete arrows yields two ordered actions.
- Renderer/session examples: running, paused, game-over, plain/color, and large-score frames all fit; 64-column or 23-row terminals show only the bounded warning, and recovery to 65×24 redraws without resetting gameplay. Repeated redraws at 65×24 must be tested for scrolling, not merely bounded string length: check the emitted cursor operations and text against a 65×24 screen/cursor model (or equivalent checked operation trace), asserting each normal redraw starts at row 1, keeps the top border on row 1, never advances beyond row 24, and triggers zero scroll operations across repeated frames. A 24-row normal frame has 23 line separators and no trailing newline; count visible widths after interpreting ANSI. While suspended at 64×24, send Left and P, recover to 65×24, and assert unchanged piece position, board, score and running phase with a fresh gravity interval; separately verify quit and Ctrl-C still exit during suspension.
- The final integration harness must exercise the actual entry path through a callable entry routine shared with the launch wrapper, supplying controlled piece generation, scheduler, terminal I/O and, if needed, an initial fixture through test-only seams (not advertised gameplay features). Its fake input and output explicitly report TTY capability, with dimensions 65×24, so the interactive session remains active for scheduled input rather than taking the non-TTY exit path. Use the production session/model wiring, not a second game implementation, to prove locking, a clear/score change, blocked spawn, restart, and quit. Separately invoke the entry path with non-TTY streams and verify one plain bounded frame and exit with no live timers or raw mode. Keep a separate actual `npm start` PTY smoke check for real launch-wrapper behavior, raw keys, frame bounds, and restored terminal; record commands/results and any accepted limitations in the task-13 report.

## Progress and revision notes

- Preparation round 1: retained all 13 tasks, acceptance checks, and unchecked states. Added shared design contracts to settle minimal rules and make model/renderer/input/scheduler/session handoffs and deterministic boundary tests explicit. No implementation or completion is claimed.
- Review round 2: addressed `suspended-input-policy` with discard-only non-exit input and recovery examples; `integration-launch-vs-nontty` with a shared entry routine, interactive TTY fakes and separate non-TTY/real-launch checks; `task11-raw-mode-interim` with minimum quit/Ctrl-C teardown before task 12; and `scroll-test-oracle` with checked cursor/screen bounds and zero-scroll assertions. Only affected contracts and verification handoffs changed; all task text, checks and unchecked states retained.

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
