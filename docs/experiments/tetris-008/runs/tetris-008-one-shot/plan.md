# Terminal Tetris implementation plan

## Requirements and approach

Build a terminal Tetris game in this target, launched with `npm start`. Keep the entire display—including board, borders, score, controls, and game-over text—within 24 terminal rows in every state. Do not commit from the implementation agent; the factory commits changes.

Use a testable game model separate from terminal I/O. Use a conventional 10-column, 20-row playfield and all seven tetrominoes. A practical display budget is 22 rows for the bordered playfield and two status/control rows; replace existing status text for messages rather than appending rows. No particular rotation system, scoring formula, or dependency is mandated: choose simple deterministic rules and document them. Keep the automated test command available as `npm test` (reuse any existing tooling if present).

R01–R13 below are the fixed acceptance catalogue. Execute the frozen T01–T13 tasks in order; only reviewed batch grouping differs between configurations.

### R01. Deliver a runnable, bounded terminal board display.
  - Inspect the target and adapt existing project conventions rather than overwriting unrelated work. Configure `npm start` to render an empty 10×20 board with borders, score, and concise controls.
  - Extract rendering into a pure function and configure an automated test command.
  - Acceptance/automated checks: starting from the target succeeds; the rendered frame contains all 20 board rows, borders, score, and controls; counting visible rows (including handling trailing newlines) never exceeds 24. Capture output without needing an interactive terminal.

### R02. Introduce tetromino definitions and initial piece generation.
  - Add all seven tetrominoes, initial board state, active-piece coordinates, and a random piece source that can be seeded or injected for tests. Spawn the initial piece in a valid centered position and render it distinctly from empty cells.
  - Acceptance/automated checks: each shape has exactly four distinct cells; every piece initially fits an empty board; deterministic generation exercises all seven types; active-piece rendering remains within the frame budget.

### R03. Implement collision-safe horizontal movement.
  - Add left/right model actions with a shared placement/collision predicate. Keep settled cells and the active piece separate.
  - Acceptance/automated checks: unobstructed movement changes position by one column; walls and settled cells reject movement without changing state; repeat movement cannot escape either wall; an active piece does not collide with itself.

### R04. Implement deterministic rotation.
  - Add clockwise rotation using a documented rule, with invalid rotations rejected (wall kicks are optional, not required). Handle the square piece consistently.
  - Acceptance/automated checks: legal rotation preserves four cells; a complete rotation cycle restores geometry; wall, floor, and settled-cell collisions cannot create overlap or out-of-bounds cells; rejected rotations preserve the original state.

### R05. Implement downward movement without locking.
  - Add a one-row downward action that reports whether movement was blocked, without merging cells or spawning pieces. This primitive will support timed falling and soft drop.
  - Acceptance/automated checks: a legal step moves exactly one row; floor and settled cells block the step; repeated steps stop at the first obstruction and leave the board unchanged.

### R06. Implement piece locking and next-piece progression.
  - Add a separate lock operation and a game action that locks when a downward attempt is blocked, then creates the next active piece. Keep blocked-spawn handling explicit for the later game-over task rather than allowing overlaps.
  - Acceptance/automated checks: locking copies exactly four cells into the board without altering unrelated cells; a successful downward move does not lock; a blocked move locks once and consumes exactly one next piece; the next piece is not advanced by the same action that spawned it.

### R07. Implement completed-line clearing and board compaction.
  - Clear full rows after locking and before next-piece placement; return the number of cleared rows as an event/result for scoring.
  - Acceptance/automated checks: zero, one, two, three, and four simultaneous clears; nonadjacent full rows clear correctly; remaining rows retain their relative order; empty rows are inserted at the top; board dimensions stay 10×20. Include an end-to-end lock-that-completes-a-row case.

### R08. Implement scoring and its display.
  - Choose and document a simple points table for cleared lines, initialize score to zero, and update score exactly once per lock/clear result. Render the live score in the reserved status area.
  - Acceptance/automated checks: verify each supported clear count, accumulation across multiple clears, and no points for ordinary movement, failed movement, rotation, or zero-line locks. Large scores must not add display rows.

### R09. Implement game-over detection and restart.
  - Detect an obstructed next spawn after line clearing, transition to a game-over state without overwriting settled cells, and show the message in existing display rows. Add restart that creates a fresh playable state.
  - Acceptance/automated checks: blocked spawn ends the game; an unblocked spawn continues; a clear that opens spawn space is processed before the decision; movement/rotation/drop actions after game over do not mutate the board or score; restart resets board, score, active piece, and game-over status. Both running and game-over frames stay within 24 rows and expose the relevant controls.

### R10. Add timed gravity and pause behavior.
  - Introduce a controllable scheduler that drives the existing downward/lock action at a documented fixed interval. Add pause/resume and display its state using the existing status rows.
  - Acceptance/automated checks with a fake clock: no fall before the interval; one expected action per tick; grounded pieces lock and progress; pause and game over stop advancement; resume/restart do not accumulate duplicate timers or catch-up falls; all displayed states remain bounded.

### R11. Connect keyboard controls to the playable terminal session.
  - Wire left/right arrows, up-arrow rotation, down-arrow soft drop, pause/resume, restart after game over, and quit; advertise the actual bindings within the display. Process input without requiring Enter in an interactive terminal.
  - Keep input decoding testable and handle unknown keys safely. If an additional hard-drop control is offered, implement and test it explicitly rather than implying support.
  - Acceptance/automated checks: feed real key byte sequences through the input adapter and verify the corresponding model actions, including multiple keys in a chunk and arrow sequences split across chunks; unknown keys cause no state change; a scripted terminal session can move, rotate, descend, pause, resume, and restart. Controls and status still occupy no more than the allocated rows.

### R12. Make terminal redraw and session teardown reliable.
  - Redraw in place instead of scrolling frames; manage raw mode, cursor visibility, input listeners, and timers for the session lifetime. Restore terminal state on quit, interruption, and handled failures. Define safe behavior for non-TTY input and terminals too small for the board, without crashing or printing an oversized frame.
  - Acceptance/automated checks with terminal/process fakes or a PTY: repeated frames replace rather than append; quit and interruption restore raw mode/cursor and remove listeners/timers; cleanup is idempotent; narrow/short-terminal warnings fit the available display; returning to a suitable size can render the bounded game frame; non-TTY startup exits or produces bounded output without hanging.

### R13. Verify and document the complete launch-to-exit experience.
  - Add concise project documentation for installation, `npm start`, `npm test`, supported terminal size, bindings, scoring, rotation, and fixed gravity behavior.
  - Add an automated integration regression that launches the actual entry point with controlled terminal I/O, exercises falling, locking, a line clear and score update, game over, restart, and quit, and checks that every emitted frame stays within 24 rows.
  - Deliver a verification report in the target recording commands performed and results, including the complete automated suite and an interactive or PTY smoke test of the actual launch command. Record any limitations honestly and resolve requirement failures before declaring completion.
  - Acceptance: `npm test` passes; `npm start` starts the playable terminal game; all required information is visible without scrolling past 24 rows in running, paused, and game-over states; exit leaves the terminal usable.

## Design and collaboration contracts

These notes clarify the seed and frozen tasks; they do not add task acceptance or change their order. Minimal choices below may be documented consistently by the doer without adding gameplay features.

- **Model ownership (T02–T09):** the model owns the 10×20 settled board, separate active piece, score, and game-over state. Placement uses one collision rule; active cells are four distinct in-bounds cells not overlapping settled cells. Rejected movement/rotation leaves state unchanged. T05 reports a blocked step only; T06 supplies the higher-level action used by both gravity and soft drop. That action either moves once or locks once, clears/compacts, scores once, then attempts one spawn, in that order. A blocked spawn is an explicit outcome, not permission to overlay settled cells. T07 supplies the clear count to T08 and the compacted board to T09. A piece spawned by an action never falls in that same action.
- **Minimal gameplay choices:** use clockwise rotation with rejected invalid placements and no required kicks; the square may remain unchanged. Use a documented fixed interval (suggested 1000 ms), a simple line points table (suggested 0/100/300/500/800 for 0–4 clears), and centered valid spawns. No levels, hold, preview, or hard drop are needed. Suggested non-arrow bindings are `p` pause/resume, `r` restart after game over, `q` quit, with interruption handled by the session. Paused gameplay actions do not advance the model; resume starts a fresh interval. Restart resets playable state rather than duplicating session resources. The doer documents exact geometry, bindings, interval, and score choices for the tests and README to share.
- **Presentation ownership (T01, T08–T12):** the pure renderer consumes a model/status snapshot and returns a bounded frame; it does not mutate state or own input/timers. Reserve 22 rows for the bordered board and two for score, controls, and state messages, replacing rather than appending text. Preserve the seed's retro ANSI styling: distinguish all seven piece types, style borders/status, reset styles, and keep plain output readable. All seven colours are verified interactively. Visible row accounting includes trailing-newline effects and terminal wrapping, not ANSI byte length. Large scores and paused/game-over messages must not expand the budget. The session supplies terminal capabilities/size and chooses a fitting warning instead of rendering a board into insufficient space.
- **Session ownership (T10–T12):** one session owns scheduler, input decoder, redraw, terminal modes, listeners, and cleanup. T10 accepts controllable time and dispatches the same model action as soft drop; T11 converts real byte chunks into actions, retaining partial arrow sequences without mutating the board for unknown input. T12 integrates those collaborators rather than creating competing loops. Quit, interruption, and handled failure converge on idempotent cleanup of owned resources and terminal restoration. A repeated cleanup or restart must not leave an extra timer/listener. Non-TTY startup may print bounded plain output and exit; resize can replace a small-terminal warning with the normal frame when space returns.
- **Verification inputs/outputs (T01–T13):** inject or seed the piece source and control clock and terminal I/O so tests can reproduce actions, state transitions, frames, and cleanup. Unit fixtures may construct boards for collision/clear cases; full production lifecycle fixtures must reach line clear, score, game over, and restart through legal input/ticks from a fresh game, never direct state edits to force game over. The actual-entry-point regression and launch smoke evidence belong to T13, not a substitute model-only simulation. Document the legal deterministic sequence and verification results so the model, session, and test collaborators agree on observed outcomes. Use an interactive or PTY launch smoke test and interactive seven-colour evidence as required by the seed.

### Execution order and boundary examples

T01 establishes rendering/testing; T02–T05 build valid piece actions; T06–T09 complete the lock/clear/score/spawn lifecycle; T10–T12 connect it to one terminal session; T13 verifies the complete launch-to-exit product. Each task needs only its scoped frozen acceptance at its intermediate stage; final delivery checks all R01–R13 and the seed together.

Examples of shared boundaries are a wall-rejected rotation preserving the original piece, a blocked T05 step leaving the board untouched versus a T06 action locking, a line clear opening spawn space before game-over detection, and pause/resume or restart producing no accumulated gravity. Terminal examples include an arrow split across two input chunks, repeated redraws not scrolling, a warning fitting a short/narrow terminal, and interruption after raw-mode setup restoring the terminal. These clarify existing checks, not additional features.

B01 deliberately contains the entire frozen sequence with no split points. Model events, frame budgeting, deterministic lifecycle evidence, and terminal cleanup share correction scope; one reviewed deliverable avoids transferring partial session ownership. Verify scoped checks along the way and finish with the complete suite, actual launch smoke, documentation, and report as one committable product. There is no four-task cap, automatic prefix selection, or runtime resource calibration in this one-shot configuration.

## Progress and revision notes

Initial author round: clarified model/render/session/test handoffs, minimal gameplay choices, seed colour and legal-lifecycle obligations, and the one-shot batch rationale. No implementation or completion is claimed; no prior findings were supplied. Frozen catalogue, task checks, order, and completion bookkeeping are unchanged.

## Completion rule

Completion requires every frozen execution task accepted, committed and recorded in batch-state.json. Verification alone does not complete missing implementation work.

## Execution plan

The author/planner clarifies contracts and reviews grouping before implementation. Frozen tasks must remain byte-equivalent as parsed JSON.

```batch-plan
{
  "version": 1,
  "tasks": [
    {
      "id": "T01",
      "title": "Deliver a runnable, bounded terminal board display.",
      "requirements": [
        "R01"
      ],
      "acceptance": [
        "Inspect the target and adapt existing project conventions rather than overwriting unrelated work. Configure `npm start` to render an empty 10\u00d720 board with borders, score, and concise controls.",
        "Extract rendering into a pure function and configure an automated test command.",
        "Acceptance/automated checks: starting from the target succeeds; the rendered frame contains all 20 board rows, borders, score, and controls; counting visible rows (including handling trailing newlines) never exceeds 24. Capture output without needing an interactive terminal."
      ]
    },
    {
      "id": "T02",
      "title": "Introduce tetromino definitions and initial piece generation.",
      "requirements": [
        "R02"
      ],
      "acceptance": [
        "Add all seven tetrominoes, initial board state, active-piece coordinates, and a random piece source that can be seeded or injected for tests. Spawn the initial piece in a valid centered position and render it distinctly from empty cells.",
        "Acceptance/automated checks: each shape has exactly four distinct cells; every piece initially fits an empty board; deterministic generation exercises all seven types; active-piece rendering remains within the frame budget."
      ]
    },
    {
      "id": "T03",
      "title": "Implement collision-safe horizontal movement.",
      "requirements": [
        "R03"
      ],
      "acceptance": [
        "Add left/right model actions with a shared placement/collision predicate. Keep settled cells and the active piece separate.",
        "Acceptance/automated checks: unobstructed movement changes position by one column; walls and settled cells reject movement without changing state; repeat movement cannot escape either wall; an active piece does not collide with itself."
      ]
    },
    {
      "id": "T04",
      "title": "Implement deterministic rotation.",
      "requirements": [
        "R04"
      ],
      "acceptance": [
        "Add clockwise rotation using a documented rule, with invalid rotations rejected (wall kicks are optional, not required). Handle the square piece consistently.",
        "Acceptance/automated checks: legal rotation preserves four cells; a complete rotation cycle restores geometry; wall, floor, and settled-cell collisions cannot create overlap or out-of-bounds cells; rejected rotations preserve the original state."
      ]
    },
    {
      "id": "T05",
      "title": "Implement downward movement without locking.",
      "requirements": [
        "R05"
      ],
      "acceptance": [
        "Add a one-row downward action that reports whether movement was blocked, without merging cells or spawning pieces. This primitive will support timed falling and soft drop.",
        "Acceptance/automated checks: a legal step moves exactly one row; floor and settled cells block the step; repeated steps stop at the first obstruction and leave the board unchanged."
      ]
    },
    {
      "id": "T06",
      "title": "Implement piece locking and next-piece progression.",
      "requirements": [
        "R06"
      ],
      "acceptance": [
        "Add a separate lock operation and a game action that locks when a downward attempt is blocked, then creates the next active piece. Keep blocked-spawn handling explicit for the later game-over task rather than allowing overlaps.",
        "Acceptance/automated checks: locking copies exactly four cells into the board without altering unrelated cells; a successful downward move does not lock; a blocked move locks once and consumes exactly one next piece; the next piece is not advanced by the same action that spawned it."
      ]
    },
    {
      "id": "T07",
      "title": "Implement completed-line clearing and board compaction.",
      "requirements": [
        "R07"
      ],
      "acceptance": [
        "Clear full rows after locking and before next-piece placement; return the number of cleared rows as an event/result for scoring.",
        "Acceptance/automated checks: zero, one, two, three, and four simultaneous clears; nonadjacent full rows clear correctly; remaining rows retain their relative order; empty rows are inserted at the top; board dimensions stay 10\u00d720. Include an end-to-end lock-that-completes-a-row case."
      ]
    },
    {
      "id": "T08",
      "title": "Implement scoring and its display.",
      "requirements": [
        "R08"
      ],
      "acceptance": [
        "Choose and document a simple points table for cleared lines, initialize score to zero, and update score exactly once per lock/clear result. Render the live score in the reserved status area.",
        "Acceptance/automated checks: verify each supported clear count, accumulation across multiple clears, and no points for ordinary movement, failed movement, rotation, or zero-line locks. Large scores must not add display rows."
      ]
    },
    {
      "id": "T09",
      "title": "Implement game-over detection and restart.",
      "requirements": [
        "R09"
      ],
      "acceptance": [
        "Detect an obstructed next spawn after line clearing, transition to a game-over state without overwriting settled cells, and show the message in existing display rows. Add restart that creates a fresh playable state.",
        "Acceptance/automated checks: blocked spawn ends the game; an unblocked spawn continues; a clear that opens spawn space is processed before the decision; movement/rotation/drop actions after game over do not mutate the board or score; restart resets board, score, active piece, and game-over status. Both running and game-over frames stay within 24 rows and expose the relevant controls."
      ]
    },
    {
      "id": "T10",
      "title": "Add timed gravity and pause behavior.",
      "requirements": [
        "R10"
      ],
      "acceptance": [
        "Introduce a controllable scheduler that drives the existing downward/lock action at a documented fixed interval. Add pause/resume and display its state using the existing status rows.",
        "Acceptance/automated checks with a fake clock: no fall before the interval; one expected action per tick; grounded pieces lock and progress; pause and game over stop advancement; resume/restart do not accumulate duplicate timers or catch-up falls; all displayed states remain bounded."
      ]
    },
    {
      "id": "T11",
      "title": "Connect keyboard controls to the playable terminal session.",
      "requirements": [
        "R11"
      ],
      "acceptance": [
        "Wire left/right arrows, up-arrow rotation, down-arrow soft drop, pause/resume, restart after game over, and quit; advertise the actual bindings within the display. Process input without requiring Enter in an interactive terminal.",
        "Keep input decoding testable and handle unknown keys safely. If an additional hard-drop control is offered, implement and test it explicitly rather than implying support.",
        "Acceptance/automated checks: feed real key byte sequences through the input adapter and verify the corresponding model actions, including multiple keys in a chunk and arrow sequences split across chunks; unknown keys cause no state change; a scripted terminal session can move, rotate, descend, pause, resume, and restart. Controls and status still occupy no more than the allocated rows."
      ]
    },
    {
      "id": "T12",
      "title": "Make terminal redraw and session teardown reliable.",
      "requirements": [
        "R12"
      ],
      "acceptance": [
        "Redraw in place instead of scrolling frames; manage raw mode, cursor visibility, input listeners, and timers for the session lifetime. Restore terminal state on quit, interruption, and handled failures. Define safe behavior for non-TTY input and terminals too small for the board, without crashing or printing an oversized frame.",
        "Acceptance/automated checks with terminal/process fakes or a PTY: repeated frames replace rather than append; quit and interruption restore raw mode/cursor and remove listeners/timers; cleanup is idempotent; narrow/short-terminal warnings fit the available display; returning to a suitable size can render the bounded game frame; non-TTY startup exits or produces bounded output without hanging."
      ]
    },
    {
      "id": "T13",
      "title": "Verify and document the complete launch-to-exit experience.",
      "requirements": [
        "R13"
      ],
      "acceptance": [
        "Add concise project documentation for installation, `npm start`, `npm test`, supported terminal size, bindings, scoring, rotation, and fixed gravity behavior.",
        "Add an automated integration regression that launches the actual entry point with controlled terminal I/O, exercises falling, locking, a line clear and score update, game over, restart, and quit, and checks that every emitted frame stays within 24 rows.",
        "Deliver a verification report in the target recording commands performed and results, including the complete automated suite and an interactive or PTY smoke test of the actual launch command. Record any limitations honestly and resolve requirement failures before declaring completion.",
        "Acceptance: `npm test` passes; `npm start` starts the playable terminal game; all required information is visible without scrolling past 24 rows in running, paused, and game-over states; exit leaves the terminal usable."
      ]
    }
  ],
  "batches": [
    {
      "id": "B01",
      "title": "Complete terminal Tetris launch-to-exit product",
      "task_ids": [
        "T01",
        "T02",
        "T03",
        "T04",
        "T05",
        "T06",
        "T07",
        "T08",
        "T09",
        "T10",
        "T11",
        "T12",
        "T13"
      ],
      "depends_on": [],
      "reason": "One-shot cohesive deliverable: model progression, bounded rendering, controllable lifecycle verification and terminal resource ownership remain together through final launch-to-exit validation; no intermediate split transfers partial session ownership.",
      "split_after": []
    }
  ]
}
```
