# Terminal Tetris implementation plan

## Requirements and approach

Build a terminal Tetris game in this target, launched with `npm start`. Keep the entire display—including board, borders, score, controls, and game-over text—within 24 terminal rows in every state. Do not commit from the implementation agent; the factory commits changes.

Use a testable game model separate from terminal I/O. Use a conventional 10-column, 20-row playfield and all seven tetrominoes. A practical display budget is 22 rows for the bordered playfield and two status/control rows; replace existing status text for messages rather than appending rows. No particular rotation system, scoring formula, or dependency is mandated: choose simple deterministic rules and document them. Keep the automated test command available as `npm test` (reuse any existing tooling if present).

Every task below must produce a focused committable change in the target, including the automated checks described. Tasks remain unchecked until their changes have been committed.

## Implementation contracts (design, not progress)

These decisions resolve the optional choices below without adding gameplay features. The doer chooses file layout, libraries, and internal API names; keep these observable contracts stable across tasks.

### Gameplay and model ownership

- Tasks 2–9 own the terminal-independent model. State consists of a 20×10 settled grid (empty or one of seven type identifiers), a separate active piece or no piece, score, and running/game-over status. Pause is an orthogonal session gate owned by task 10. Renderers never mutate state, draw an active piece into the settled grid, consume randomness, or advance time.
- Use conventional I, O, T, S, Z, J, L shapes. Use fixed local square rotation boxes: I is 4×4, O is 2×2, others are 3×3. Initial geometry and orientations must be documented/tested; clockwise rotation maps local (x,y) to (N−1−y,x), with O a no-op. No wall kicks, hidden rows, hold, preview, hard drop, levels, or lock delay are required. Spawn each box at x=floor((10−N)/2), y=0. No occupied cell may have x outside 0…9 or y outside 0…19.
- The shared placement predicate (task 3) checks occupied cells only, against bounds and settled cells. Rejected movement/rotation preserves all gameplay state and consumes no piece. Every live active piece has four distinct legal cells. The downward primitive (task 5) returns moved/blocked and never locks; the downward game action (task 6) performs exactly one primitive attempt. If blocked, it merges four cells, clears rows (task 7), awards points (task 8), then attempts one spawn (task 9), in that order. There is no second descent in this transaction. Intermediate implementations must represent a blocked spawn explicitly rather than leave an overlapping active piece.
- Clearing returns a count and the compacted grid; scoring consumes that result once, not during rendering. Use 0/100/300/500/800 points for 0/1/2/3/4 rows. No movement or drop points. A failed spawn leaves the settled grid and earned score intact, sets game over, and leaves no active piece. A clear that removes a spawn obstruction must precede the collision check.
- The piece source returns type identifiers and is injectable; production may sample the seven types uniformly (no bag guarantee required). Initial creation and each post-lock spawn consume exactly one type, including a failed spawn; rejected actions, redraws, and pause consume none. Restart is available only at game over: empty grid, score zero, running/unpaused, one fresh spawn from the same source, and a fresh gravity interval. It need not rewind the source. After game over all gameplay actions except restart are no-ops.

### Collaboration boundaries and dependencies

- Task 1 owns the pure frame formatter and startup/test scaffold; tasks 2, 8, 9, and 10 supply piece/score/status data to it. Task 12 owns transport of complete frames, not model rules. The formatter returns a complete bounded frame, not terminal positioning commands. It supports ANSI-coloured and unstyled output with identical visible geometry; task 13 documents the public launch contract.
- Model actions expose whether state changed and the blocked/lock/clear/spawn outcome needed by callers/tests, without requiring a particular object schema. Task 6 composes tasks 3 and 5; task 7 inserts clearing into that transaction; tasks 8 and 9 consume its results. Keep existing action behavior compatible as later stages attach outcomes. Task 4 shares task 3's predicate.
- Task 10 owns clock scheduling and pause gating; task 11 only decodes bytes to commands and dispatches through that gate; task 12 owns input/output resources and teardown. Task 11 verifies its scripted session using injected byte streams and the task 10 gate, without acquiring raw mode; its no-Enter requirement means dispatch immediately on complete byte sequences, not on newline. Task 12 supplies and verifies the actual interactive no-Enter behavior together with raw-mode restoration on quit. Task 13 integrates those same production paths. Task order is the dependency order for this plan: each task retains earlier automated checks, and integration tests must not replace production rules with a second implementation.

### Clock, input, and lifecycle contracts

- Gravity is fixed at 500 ms. Inject a clock/scheduler so tests advance it without wall-clock sleeps. Each callback dispatches one downward game action; no elapsed-time catch-up loop. Pause cancels advancement; resume and restart schedule the first fall a full interval later. At most one gravity schedule exists, and stale callbacks cannot advance a paused, ended, or disposed session. Left/right/rotate/soft-drop are ignored while paused; pause has no effect at game over. Down-arrow dispatches the same downward game action as gravity, including immediate lock on blockage. Successful soft drops and soft-drop-induced locks do not reset the gravity schedule: it retains its phase, including for the newly spawned piece. If gravity is due at 500 ms and down is pressed at 300 ms, the next fall is still due at 500 ms in both cases (unless the lock ends the game). Task 10 fake-clock checks cover both movement and lock cases, asserting no extra descent before that deadline and exactly one gravity action at it.
- Bind arrows to left/right/clockwise/down, P (either case) to pause/resume, R to restart at game over, Q and Ctrl-C to quit. Do not advertise unsupported hard drop. Task 11's streaming decoder retains incomplete arrow prefixes across chunks and emits commands in byte order, including several commands in one chunk. Unknown bytes and unsupported escape sequences are ignored, never interpreted as movement; incomplete input cannot hang shutdown or require Enter. Pause/restart/quit routing follows the state gates above.
- Inject terminal streams, size/TTY information, and lifecycle notifications as well as clock and piece source. Production uses real process resources; tests use finite scripted input and captured output. Task 13 may use an internal fixture/state/source seam to reach a clear and blocked spawn quickly, but must launch the actual entry point and exercise its real decoder, dispatcher, model, scheduler, renderer, and cleanup. No user-facing test feature or new gameplay control is needed.
- Task 12 acquires raw mode only for TTY input and restores the prior mode; cursor visibility, listeners, and timers are restored/removed on quit, EOF, SIGINT/SIGTERM, and handled runtime failure. Cleanup runs once logically even when called repeatedly. Failures report a bounded readable message and exit unsuccessfully after cleanup; output-write failure must not trigger recursive writes. Injected failure and signal tests verify cleanup, not just the normal quit path.

### Display and observable boundary contracts

- Use 20 board rows plus top/bottom borders and two status/control rows: exactly 24 visible rows for a normal frame. Score, pause, game-over text, and relevant controls replace those two rows rather than append. Use ASCII cell geometry (two columns per board cell is sufficient), seven distinct ANSI type colours, and styled border/status. Empty/occupied cells and controls remain understandable with colours disabled; ANSI spans are reset so styles cannot leak beyond the frame.
- Choose and document a fixed minimum width W sufficient for the longest normal control/status row; all normal rows fit W columns and all score text fits its reserved width (abbreviate very large values for display only). Required terminal height is 24. Avoid a trailing newline or bottom-right write that induces scrolling. Frame tests count visible rows including trailing-newline effects, strip ANSI for width assertions, and include paused/game-over and oversized-score cases. Task 12 terminal transport clears the screen at TTY startup and draws the first complete frame at row 1, column 1, regardless of preceding launch output. Every redraw uses absolute positioning from that origin (rows 1–24), not relative movement from the previous cursor or repeated line appends. No newline follows row 24, and no write at the terminal's bottom-right cell may induce scrolling.
- For TTY dimensions smaller than W×24, show only a clipped warning fitting the reported positive width/height, with no gameplay frame; suspend gravity and gameplay commands except quit. On return to sufficient size, redraw the unchanged state and start a fresh interval if otherwise running/unpaused. Do not attempt a visible write for zero-sized dimensions. For non-TTY startup, emit one unstyled bounded snapshot and exit without raw mode, timers, or waiting for input. The non-TTY 24-row output budget includes all stdout/stderr from the documented `npm start` launch, not just the formatter: suppress npm lifecycle banners through project-local launch configuration so the single 24-row snapshot fits. Do not substitute `node` or `npm start --silent` as the documented launch or as evidence for this budget. Controlled TTY fakes/PTYs, not the non-TTY snapshot path, verify interactive play.
- Boundary examples complement every acceptance check below: a piece flush against a wall rejects one more lateral step unchanged; a floor-blocked primitive leaves the grid alone while the game action locks once; a four-line lock awards 800 once even across redraws; an obstructed next spawn consumes one type but never overwrites cells; 499 ms causes no fall and 500 ms causes one; pause/resume starts a fresh 500 ms wait; a split ESC/[ /A stream produces one rotation; resizing to 1×1 yields at most one visible cell, not a wrapped game frame. A 24-row redraw must not scroll a 24-row terminal. Include deterministic fixtures for these boundaries alongside the unchanged task checks.

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

  - Clarifying integration checks: verify immediate key handling without Enter in a TTY and restoration of prior raw mode on quit; start and repeatedly redraw at exactly 24 rows without scrolling, including when startup follows preexisting terminal text.

- [ ] 13. Verify and document the complete launch-to-exit experience.
  - Add concise project documentation for installation, `npm start`, `npm test`, supported terminal size, bindings, scoring, rotation, and fixed gravity behavior.
  - Add an automated integration regression that launches the actual entry point with controlled terminal I/O, exercises falling, locking, a line clear and score update, game over, restart, and quit, and checks that every emitted frame stays within 24 rows.
  - Deliver a verification report in the target recording commands performed and results, including the complete automated suite and an interactive or PTY smoke test of the actual launch command. Record any limitations honestly and resolve requirement failures before declaring completion.
  - Acceptance: `npm test` passes; `npm start` starts the playable terminal game; all required information is visible without scrolling past 24 rows in running, paused, and game-over states; exit leaves the terminal usable.
  - Launch-boundary checks: run exactly `npm start` from the target in a 24-row PTY at the documented minimum width, checking the complete frame occupies rows 1–24 from startup through redraws without scrolling. Also capture stdout/stderr of exactly `npm start` in non-TTY mode and verify the total visible output stays within 24 rows, is unstyled, and exits promptly. Record these commands and results in the verification report; direct-entry-point integration tests alone do not satisfy these launch checks.

## Plan revision notes (not implementation progress)

- Review preparation, round 1: added the compact implementation contracts above to fix gameplay defaults, ownership and handoffs, deterministic test seams, lifecycle/size policies, and boundary examples. All 13 task identities, acceptance checks, and unchecked states are unchanged. No implementation work is recorded here.

- Review revision, round 2: addressed `launch-display-contract` with startup clearing, absolute redraws, an inclusive npm-output budget, and exact `npm start` PTY/capture checks (formatter/transport/documentation, tasks 1 and 12–13). Addressed `task11-input-boundary` by separating injected no-newline dispatch checks from task 12's interactive raw-mode/restoration verification (tasks 10–12). Addressed `soft-drop-clock-contract` by preserving gravity phase for both soft-drop movement and locks, with 300/500 ms fake-clock examples (tasks 6 and 10–11). Existing checks and all unchecked states retained; no implementation progress recorded.

## Completion rule

The plan is complete only when every task and subtask above has been delivered and committed, with no unchecked task remaining. Verification alone does not complete missing implementation work.
