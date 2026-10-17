# Terminal Tetris implementation plan

## Requirements and approach

Build a terminal Tetris game in this target, launched with `npm start`. Keep the entire display—including board, borders, score, controls, and game-over text—within 24 terminal rows in every state. Do not commit from the implementation agent; the factory commits changes.

Use a testable game model separate from terminal I/O. Use a conventional 10-column, 20-row playfield and all seven tetrominoes. A practical display budget is 22 rows for the bordered playfield and two status/control rows; replace existing status text for messages rather than appending rows. The minimal gameplay and boundary contracts below fix the choices needed for collaboration; implementation structure and dependencies remain the doer's choice. Keep the automated test command available as `npm test` (reuse any existing tooling if present).

Every task below must produce a focused committable change in the target, including the automated checks described. Tasks remain unchecked until their changes have been committed.

## Design and collaboration contracts

These notes supplement, rather than replace, every task/check below. Task numbers identify responsibility, not prescribed modules or coding techniques. Do not add hold, previews, levels, hard drop, sound, or other optional gameplay.

### Model and rules (tasks 2–9)

- Task 2 owns the shared state/shape vocabulary; tasks 3–5 own geometric actions; task 6 owns the lock/progression transaction; task 7 supplies compaction and clear count; task 8 supplies score calculation; task 9 supplies terminal game status and restart. The renderer and session consume these results, never change board cells themselves.
- Coordinates use columns 0–9 left-to-right and rows 0–19 top-to-bottom. Settled cells are empty or a tetromino type, distinct from an active piece containing type, orientation and origin. No hidden rows: every active cell must be inside the board and disjoint from settled cells. Running/paused states have one valid active piece; game over has none. Score is a nonnegative integer. Intermediate tasks may expose a blocked-spawn result, but must never publish an overlapping active piece.
- Define each type in a fixed local square (I: 4×4, O: 2×2, others: 3×3). Spawn in a documented initial orientation, at row zero with its square horizontally centered (round down). Task 2 publishes the actual cell tables for task 4 and its tests. Clockwise rotation is within that fixed square, without kicks; O is unchanged. Four clockwise turns restore cells and origin. Reject any illegal candidate without changing state, including the orientation.
- Use independent uniform choices among the seven types; no bag/randomness guarantees beyond that. Task 2 accepts an injected piece source so tests can supply an exact sequence; production uses ordinary randomness. Consume one type at initialization and one per completed lock/progression, not on render, failed moves or pause. Restart consumes one fresh type from the current source rather than rewinding it.
- Task 5's downward primitive returns moved/blocked and never locks. Task 6's gameplay descent (gravity and soft drop alike) moves one row if possible; otherwise it locks the current four cells once, clears rows through task 7, applies task 8's score once, then consumes and attempts the next spawn. No lock delay. The new piece does not descend in that transaction. Expose the clear count and blocked-spawn outcome so later tasks need not infer events from rendered output.
- Clear all full rows simultaneously and preserve surviving rows' relative order. Award 0/100/300/500/800 points for 0/1/2/3/4 cleared lines; no drop/movement points or speed changes. Spawn validity is checked only after compaction. A blocked spawn retains the resulting settled board and score and enters game over. For example, a lock clearing a row near the top may free the next spawn and must not prematurely end the game.
- In paused or game-over states, movement, rotation and descent are no-ops, including piece-source consumption. Restart is accepted only at game over: empty board, zero score, fresh valid piece, running/unpaused. Quit works in every state; pause only toggles while playable. Repeated blocked horizontal moves/rotations preserve all state; a grounded descent changes exactly one lock transaction, not repeated locks of the old piece.

### Display, time and I/O (tasks 1, 10–12)

- Task 1 owns a pure state-to-frame contract used by all later display additions. Use two character columns per board cell: 22 bordered board rows plus two status/control rows, with no extra message rows. Minimum interactive terminal is 64 columns × 24 rows. Keep every normal line within 64 visible columns (including controls and large-score formatting); abbreviate/clip status in place without altering numeric model score. A frame has at most 24 physical rows, no trailing newline that moves onto a 25th row, and no wrapping. Tests measure rows/columns after stripping ANSI, including blank lines and trailing newlines.
- Task 2 supplies seven distinct type colours to the renderer; task 1/12 own border/status colour and ANSI resets. Use visible filled versus empty characters so no-colour output remains readable. End styled output with a reset; plain captured rendering can disable ANSI. Rendering has no random draws, clock reads, state changes or input dependencies. Running, paused and game-over messages replace reserved status text, with bindings readable in each applicable state.
- Task 10 owns a fixed 500 ms gravity cadence and scheduler lifecycle, consuming task 6's gameplay descent. Inject scheduling/time for tests. No action at startup or before a full interval; each tick produces one action without elapsed-time catch-up. Pause, game over, or an undersized terminal suspends gravity. Resume, restart or return to suitable size begins a fresh full interval; at most one timer exists. Task 12 informs the scheduler about terminal suitability; terminal suspension does not change the player's explicit pause choice.
- Task 11 maps arrows to left/right/clockwise/soft drop, P (either case) to pause/resume, R to restart after game over, and Q or Ctrl-C to quit. No hard drop. The decoder accepts bytes/chunks, retains incomplete arrow prefixes across chunks, emits ordered actions for multiple keys, and ignores unsupported complete sequences without interpreting their payload as gameplay keys. For example, split ESC + `[D` emits exactly one left action; an unsupported escape sequence emits none. Decoder state and pending partial input are cleared at teardown.
- Task 12 owns terminal capability/size discovery, input/raw-mode setup, in-place redraw and cleanup; it receives frames from task 1 and decoded actions from task 11. Do not append frames or emit a bottom-row newline. On non-TTY startup, emit at most one plain bounded frame and exit without raw mode or timers. On undersized TTYs, replace the game with a clipped size warning fitting available rows/columns, keep quit and resize handling active, and avoid drawing when dimensions are zero. Returning to adequate size restores the current game without resetting it.
- Acquire terminal resources only for an interactive session. Quit, Ctrl-C, SIGINT/SIGTERM and handled runtime failures use the same idempotent cleanup: cancel scheduler, remove owned input/resize/signal listeners, restore prior raw state, reset styles and restore cursor visibility. Failure diagnostics must replace status or follow cleanup, not append to an active 24-row frame; failures exit nonzero. Test setup failure after partial acquisition as well as normal exit and repeated cleanup. No persistence or external network/service is needed.

### Dependencies and verification handoffs

- Sequence is 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13. Task 6 initially exposes a clear/scoring integration boundary and blocked-spawn outcome; tasks 7–9 finish that transaction rather than create competing descent paths. Task 9 also gates all model actions by status. Task 10 and task 11 share the same action boundary. Each task retains earlier regression checks; later integration must not invalidate earlier primitives.
- Tasks 1–9 supply deterministic fixtures and pure model/frame checks. Tasks 10–12 supply controllable clock, input, output, dimensions and lifecycle adapters/fakes. Task 13 uses those seams to exercise the actual entry point, including deterministic piece sequences and prearranged near-clear/near-game-over fixtures; these are test harness inputs, not new user-facing cheat controls. Do not replace entry-point coverage with model-only tests. Also smoke-test the real `npm start` command in an interactive terminal or PTY, covering colour/redraw and usable exit.
- Boundary evidence includes: rejected rotations at walls/floor/settled cells; a grounded descent consuming exactly one next type; nonadjacent full rows compacting in order; clear-before-spawn survival; inert paused/game-over input; a huge score fitting status; split/multiple/unknown input sequences; pause/restart/resize with no duplicate timer; narrow/short/zero-size output; and failure cleanup after partial setup. Task 13 records observed commands/results and honest limitations, separately from these contracts.

## Progress and revision notes

- Round 1 preparation: clarified shared gameplay, state, rendering, timing/input, lifecycle and verification contracts above. All 13 task identities, existing acceptance checks and unchecked states are retained; no implementation performed. No prior synthesis findings were supplied.

## Implementation tasks

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
