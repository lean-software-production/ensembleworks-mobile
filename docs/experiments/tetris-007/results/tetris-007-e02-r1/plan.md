# Terminal Tetris implementation plan

## Requirements and approach

Build a terminal Tetris game in this target, launched with `npm start`. Keep the entire display—including board, borders, score, controls, and game-over text—within 24 terminal rows in every state. Do not commit from the implementation agent; the factory commits changes.

Use a testable game model separate from terminal I/O. Use a conventional 10-column, 20-row playfield and all seven tetrominoes. A practical display budget is 22 rows for the bordered playfield and two status/control rows; replace existing status text for messages rather than appending rows. The shared contracts below select minimal gameplay rules for implementation; no particular dependency or internal coding structure is mandated. Keep the automated test command available as `npm test` (reuse any existing tooling if present).

Every task below must produce a focused committable change in the target, including the automated checks described. Tasks remain unchecked until their changes have been committed.

## Shared design and collaboration contracts

These contracts clarify the existing tasks, not additional features. Task numbers below identify responsibility owners and consumers, not prescribed modules or APIs. All existing acceptance checks remain required.

### Model and gameplay

- Task 2 owns shape definitions, spawn geometry, and initial state; tasks 3–9 consume them. Coordinates are integer columns 0–9 and rows 0–19, increasing right/down. Settled cells are empty or retain their tetromino type; the active piece is separate. Every running active piece has four distinct in-bounds cells, none overlapping settled cells. There are no hidden rows. Rejected actions preserve all model state and consume no randomness.
- Use fixed local rotation boxes: I in 4×4, O in 2×2, others in 3×3. Task 2 documents the initial four-cell layouts; task 4 owns clockwise quarter-turns within those boxes, with no wall kicks and O unchanged. Spawn in initial orientation at row 0 with the box centered horizontally (round left). All seven must fit an empty board. Four rotations restore position and geometry, including near obstacles when all four turns are legal.
- Task 2 owns an injectable piece source: default independent uniform selections among seven types; no bag, preview, hold, or hard drop. A seeded source or scripted type sequence must reproduce play without real randomness. Initial creation and restart each request one piece; each completed lock requests exactly one successor. Movement, rejected rotation, rendering, pause, and game-over input request none. Restart uses the continuing source, not an implicit reseed.
- Task 3 owns the shared placement predicate consumed by rotation, downward movement, and spawning. Task 5 owns the nonlocking downward primitive: report moved or blocked; blocked means identical state. Task 6 owns the composed descend action used by both gravity and soft drop: move once if possible, otherwise lock once. Lock consumes the active piece, never overwrites occupied cells, and cannot merge that same piece twice. The low-level lock is for a valid grounded piece, not an independent user control.
- Task 6's transition passes the newly settled board to task 7's compaction, then task 8's scoring, then task 2's successor spawn. Task 7 returns compacted board plus clear count; task 8 adds points once per transition: 0/100/300/500/800 for 0/1/2/3/4 lines. No levels, speed changes, or drop points. Task 9 owns the final blocked-spawn decision. For task 6 before task 9, expose a blocked-spawn result with no overlapping active piece; do not silently retry or draw another type.
- Stable state is running, paused, or game over, with nonnegative score and a 10×20 settled board. Running/paused retain a valid active piece; game over has no active piece and retains the final compacted board and score. Task 9 makes blocked spawn terminal after clearing/scoring, without copying the attempted piece onto the board. Restart is available only at game over and resets board/score/status, spawns a fresh piece, and starts unpaused. Movement, rotation, and descend are no-ops while paused or game over; pause cannot escape game over.

### Presentation, session, and controllable boundaries

- Task 1 owns a pure state-to-frame renderer, consumed by all display tasks and the task 12 presenter. Use 20 board rows plus two border rows and two status/control rows: at most 24 visible rows in every game state. Use two character columns per board cell (22-column bordered board); support terminals at least 48 columns × 24 rows, and keep each status line within 48 columns. Replace status text for pause/game-over; never append messages. Keep the actual applicable controls visible. Large scores may use a bounded compact representation rather than wrap; model score is not truncated.
- Task 2 supplies type identities; the renderer uses seven distinct retro ANSI foreground colours, styled border/status, and readable type letters plus distinguishable empty cells when colour is disabled or stripped. Task 1 establishes the rendering contract and task 13 verifies the final styling. ANSI styling must reset at frame end, and session cleanup also resets styles. Colour/control sequences do not count as visible columns. No embedded line breaks in cells/status fields; no trailing newline that creates a 25th row. Tests count terminal-visible rows and account for wrapping, not only newline separators.
- Task 10 owns a controllable scheduler: fixed 1000 ms gravity, one composed descend per delivered tick, no elapsed-time catch-up. Pause, game over, and terminal-size suspension cancel advancement. Resume, restart, or recovery to adequate size starts a fresh full interval and leaves at most one timer. Resize suspension is a session gate, not a change to user pause; recovery must not unpause a user-paused game. Fake time must verify tick boundaries and cancellation, including 999 ms unchanged, 1000 ms one action, and a grounded tick locking without moving its successor.
- Task 11 owns streaming byte decoding and action dispatch: arrows left/right/move, up/rotate, down/descend; P/p pause, R/r restart at game over, Q/q and Ctrl-C quit. Task 12 owns Ctrl-C/process interruption cleanup. Decoder emits ordered actions for concatenated sequences and buffers incomplete arrow sequences across chunks; unknown complete sequences are ignored, not interpreted as arrow fragments. No Enter required. Quit remains available while paused, game over, or undersized.
- Task 12 owns the session lifecycle and external I/O: input/output, terminal dimensions/resize, timer creation/cancellation, and interruption/failure hooks must be replaceable by fakes. Renderer never reads the terminal or changes the model. Session serializes input/ticks so one event completes before another; it renders the resulting state and does not advance gameplay from rendering. Clear/home or equivalent in-place presentation must avoid scrolling, including the bottom-right terminal cell.
- For non-TTY input or output, emit at most one plain bounded diagnostic and exit without raw mode or timers. For undersized interactive terminals, suspend gameplay and replace the frame with a clipped warning within the available rows/columns (zero-sized area emits no visible text); resize back restores the same game state and bounded frame. Never print a full board into an undersized area. Quit, interruption, and handled runtime errors share idempotent cleanup: stop timers, remove owned listeners, restore previous raw mode/cursor state and styles. Failure reporting must not append an oversized frame or leave an active session.

### Dependency handoffs and observable verification

- The numbered sequence is the default dependency order. Tasks 1–2 establish renderer/model fixtures; 3 supplies placement to 4–6; 5 supplies descent to 6; 6→7→8→9 completes the lock pipeline; 10 consumes that pipeline and state gates; 11 dispatches its actions; 12 wraps their lifecycle; 13 verifies the complete entry point. Later tasks may refine earlier seams but must preserve all earlier checks.
- Collaborators exchange documented state/action/result semantics, not duplicate collision, scoring, or locking logic. Task 7's clear count and task 6's blocked-spawn outcome are explicit handoffs. Task 13 consumes the same controlled source, clock, and terminal adapters used in unit checks. Integration may use deterministic fixtures through a test harness around the actual entry point, not a separate simulation or new player-facing cheat controls; also smoke-test the real `npm start` path.
- Boundary examples to retain in tests: a piece flush against a wall cannot move through it; a floor-blocked rotation changes nothing; a blocked descent settles exactly four cells, clears before spawn, scores once, and leaves the successor at spawn; two nonadjacent full rows compact in order; a clear opening spawn space permits play while the same uncleared obstruction ends it. Paused input/ticks leave board and score unchanged. Split `ESC [` then `D` acts as one left key; repeated quit/cleanup does not restore twice or leak listeners. Running, paused, game-over, huge-score, undersized, and failure outputs must remain bounded.

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

## Plan revision notes (not implementation progress)

- Review preparation, round 1: added shared contracts for minimal gameplay, model/render/session ownership, deterministic dependencies, lifecycle failure behavior, and boundary examples. Clarified handoffs across tasks 1–13 without changing task identities, acceptance checks, or completion states. No implementation performed; no prior findings supplied.

## Completion rule

The plan is complete only when every task and subtask above has been delivered and committed, with no unchecked task remaining. Verification alone does not complete missing implementation work.
