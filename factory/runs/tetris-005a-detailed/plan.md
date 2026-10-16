# Terminal Tetris implementation plan

## Goal and implementation boundaries

Build a playable terminal Tetris game launched with `npm start`. The entire display—including the board, borders, score, controls, and game-over text—must fit within 24 terminal rows.

Use a 10-column by 20-row visible board, seven tetrominoes, and a compact layout of at most 24 rows. Prefer Node.js with a pure, deterministic game engine separated from terminal rendering and input. Use Node's built-in test runner (or an existing equivalent) so behavior can be checked without an interactive terminal. No extra features such as hold, multiplayer, or advanced rotation standards are required. Define and test consistent simple rotation rules rather than assuming full guideline compliance.

Each task below is a separate committable increment. Keep tasks and subtasks unchecked until the factory confirms their work has been committed. Add automated checks in the same change as the behavior being introduced. Tests should inject randomness, elapsed time, and terminal I/O where relevant rather than sleep or depend on a real TTY.

## Tasks

- [x] 1. Deliver a runnable compact terminal display and test command.
  - [x] Add the minimum package configuration and entry point so `npm start` launches a terminal display and `npm test` runs automated tests.
  - [x] Render a 10-by-20 empty board with borders, score, and concise control instructions in at most 24 rows. Establish a reusable frame renderer instead of printing scrolling frames.
  - [x] Include clean exit behavior for this initial display, and a clear non-interactive invocation policy so pipes or CI cannot hang indefinitely.
  - [x] Acceptance checks: automated frame tests count logical rows, strip terminal escapes when needed, verify 20 visible board rows and all required labels, and prove the frame fits in 24 rows. Test entry-point non-TTY behavior and run a launch smoke check.

- [x] 2. Represent and spawn all seven tetrominoes.
  - [x] Add pure board and active-piece state with explicit coordinates, immutable or otherwise predictably isolated state transitions, and all seven piece definitions.
  - [x] Add an injectable random piece source and spawn each selected piece centered at the top of an empty board. Render the active piece over the settled board without modifying settled cells.
  - [x] Acceptance checks: automated tests cover every piece, exactly four distinct cells per piece, valid empty-board spawn coordinates, deterministic injected selection, independent fresh boards, and rendering with no settled-board mutation.

- [x] 3. Implement collision-aware horizontal movement.
  - [x] Add a shared placement predicate for board boundaries and occupied cells, including an explicit policy for cells above the visible board if the chosen spawn representation permits them.
  - [x] Add left/right actions that move a valid active piece exactly one column and leave state unchanged for illegal movement.
  - [x] Acceptance checks: automated tests cover both walls, occupied-cell collisions, all piece shapes, successful movement through open space, and repeated blocked actions without board corruption.

- [x] 4. Implement predictable piece rotation.
  - [x] Define clockwise rotation states or transforms for each shape; preserve the square's occupied footprint.
  - [x] Apply rotation only when the resulting placement is valid. Use a documented no-wall-kick rule unless a small explicit kick policy is deliberately implemented and tested.
  - [x] Acceptance checks: automated tests verify four rotations restore each piece's orientation, expected individual orientations, square behavior, valid open-space rotations, and rejection or specified kicks at walls, floor, and settled cells.

- [x] 5. Implement downward movement and piece locking.
  - [x] Add a one-row descent action; when a downward step is blocked, settle the piece exactly once and spawn the next piece. Use immediate locking rather than adding a lock-delay subsystem.
  - [x] Keep the lock/spawn transition explicit so subsequent line clearing and game-over checks can be inserted in the correct order.
  - [x] Acceptance checks: automated tests cover descent in open space, floor locking, locking on a stack, preservation of existing cells, exact placement of all four cells, and one successor spawn per lock. Do not silently overwrite occupied cells or index outside the board.

- [x] 6. Add elapsed-time gravity.
  - [x] Advance downward using a fixed documented gravity interval and injectable elapsed-time updates, reusing descent and locking behavior.
  - [x] Define how large elapsed-time updates are handled so updates are deterministic and bounded, and ensure a newly spawned piece does not inherit unintended timing debt.
  - [x] Acceptance checks: automated tests cover time below the interval, an exact interval, accumulated partial intervals, large updates under the documented policy, and gravity-triggered locking. Tests must not use real delays.

- [x] 7. Clear completed rows after locking.
  - [x] After settling a piece, remove all full rows simultaneously, shift surviving rows down, and insert empty rows at the top before checking the next spawn.
  - [x] Expose the count of rows removed for scoring without introducing score behavior in this task.
  - [x] Acceptance checks: automated tests cover zero, one, two, three, and four rows cleared, adjacent and separated full rows, stable survivor order, no removal of incomplete rows, and preservation of the 10-by-20 dimensions.

- [x] 8. Award and render line-clear scores.
  - [x] Choose and document a simple fixed score table for one through four simultaneous cleared rows; initialize the score to zero and award points once per lock/clear transition.
  - [x] Connect score state to the compact display. Keep speed fixed unless progression is separately specified; do not add unnecessary level mechanics.
  - [x] Acceptance checks: automated tests verify each score-table entry, no-clear locks, cumulative scoring over multiple locks, no repeated awards on rendering or unrelated actions, and display height with large score values.

- [x] 9. Detect game over without corrupting the board.
  - [x] End play when the next piece cannot spawn after line clearing. If the representation permits above-board cells, explicitly handle locking above the visible board as a terminal condition.
  - [x] Stop accepting gameplay transitions after game over while retaining final board and score; show a game-over message inside the existing 24-row frame.
  - [x] Acceptance checks: automated tests cover obstructed spawns, valid near-top spawns, a clear that frees the spawn region before the check, relevant above-board cases, frozen terminal state, and a complete game-over frame within 24 rows.

- [x] 10. Add hard drop as a separate game action.
  - [x] Move the active piece to the lowest legal position and lock it exactly once, reusing the established clear, score, spawn, and game-over transitions.
  - [x] Do not award drop points unless explicitly documented; keep the line-clear score policy unchanged.
  - [x] Acceptance checks: automated tests cover an empty board, an uneven stack, an already grounded piece, a drop that clears lines, and a drop that causes game over. Verify no tunneling through occupied cells and equivalence to repeated downward steps through the first lock.

- [x] 11. Wire keyboard controls to the live game loop.
  - [x] Connect terminal input and the gravity loop to engine actions: Left/Right move, Up rotates, Down descends, Space hard-drops, and Q or Ctrl-C quits. Optional letter aliases must appear in the instructions if included.
  - [x] Parse split and combined input sequences reliably using a terminal-key API or an explicitly tested decoder. Ignore unsupported keys safely.
  - [x] Redraw complete frames in place without growing terminal output; ensure quit is handled even after game over. Keep input processing separate from pure engine rules.
  - [x] Acceptance checks: automated fake-input/fake-clock tests exercise every documented key, repeated and combined input, idle gravity, unsupported input, post-game-over quit, and cancellation of timers on exit. Run an interactive smoke check of `npm start`.

- [x] 12. Harden terminal size handling and cleanup.
  - [x] Enter and restore terminal modes consistently, including raw mode, cursor visibility, and any alternate screen used. Restore them on normal quit, Ctrl-C, termination, and handled runtime failure.
  - [x] Handle resize events. When fewer than the required rows or columns are available, pause gameplay and show a bounded size warning rather than wrapping or scrolling the board; resume without accumulating gravity debt when space returns.
  - [x] Retain the non-TTY policy and ensure all status/warning output respects the terminal size and never expands the complete game beyond 24 rows.
  - [x] Acceptance checks: fake-terminal automated tests cover exact-fit dimensions, undersized height and width, resize down/up, cleanup paths, idempotent cleanup, and no callbacks after exit. Confirm frame widths prevent wrapping at the documented minimum width.

- [x] 13. Document play and deliver an end-to-end verification report.
  - [x] Add concise project documentation for installation, `npm start`, `npm test`, controls, minimum terminal dimensions, scoring, rotation/locking policies, and non-TTY behavior.
  - [x] Add an automated scripted-session regression test spanning movement, rotation, timed descent, locking, clearing, scoring, and game over through the application adapter. Use deterministic fixtures rather than relying on random outcomes.
  - [x] Run the complete automated suite and an actual terminal launch/play/quit smoke check, including final-score/game-over display and a resize scenario where feasible.
  - [x] Commit a verification report in the target recording commands/checks, results, observed maximum display rows, and any environment limitations. Do not report an unperformed manual check as passing.
  - [x] Acceptance checks: documented commands work from the project root; the integration regression passes; the report accounts for every seed requirement and records concrete results or explicit limitations.

## Completion rule

The plan is complete only when all tasks and subtasks above are checked after their corresponding changes have been committed. The required outcome is a playable terminal Tetris game started by `npm start`, with automated rule coverage and a complete display no taller than 24 terminal rows.
