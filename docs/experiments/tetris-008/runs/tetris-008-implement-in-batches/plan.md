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

## Collaboration contracts (design, not progress)

These clarify the seed and frozen checks, not additional task acceptance. Preserve task definitions and order; no previews, hold, levels, or hard drop are needed.

- **Model → rendering/session:** The model owns the 10×20 settled grid, separate active piece, score, and status. Settled cells retain piece identity for colours. Playable active cells are distinct, in bounds, and do not overlap settled cells. Rejected placement leaves state unchanged. Use simple centered valid spawns and clockwise rotation with invalid placements rejected; kicks are unnecessary. The doer documents precise geometry, consistent square behavior, and a simple line-score table; no specific formula is imposed.
- **Movement → progression:** Nonlocking descent reports movement or obstruction. Progression on obstruction locks once, clears/compacts, scores once, then attempts one next spawn. The newly spawned piece does not move in that action. A clear opening spawn space continues play; obstruction after clearing ends play without overwriting cells. Game-over gameplay actions are inert; restart creates fresh running state.
- **Renderer → terminal:** Rendering consumes state without mutation and returns a complete frame. Budget 22 rows for bordered board plus two for score/status/actual controls; messages replace existing text. Preserve the seed's retro ANSI styling: seven distinguishable tetromino colours and styled border/status, style resets, and readable plain output. Verify all seven colours interactively. Visible-row accounting includes trailing-newline behavior, not ANSI byte counts; long scores/messages and terminal width must not cause wrapping beyond the budget.
- **Controller → model:** Gravity and soft drop use the same progression action. Pause suppresses gameplay advancement; resume and quit remain accessible, and restart is available after game over. Document a fixed interval; resume/restart start a fresh interval without catch-up. A tick before the interval does nothing; a grounded tick progresses exactly once.
- **Session owns I/O lifetime:** One session owner coordinates the scheduler, input decoder, redraw, resize, raw mode, cursor, listeners, and idempotent cleanup on quit, interruption, or handled failure, including partial setup. Model/renderer acquire no terminal resources. Decoding consumes byte chunks and emits actions, preserving incomplete escape sequences across chunks; unknown keys do not mutate state. Non-TTY launch may print one bounded plain frame and exit. An undersized terminal shows only a fitting warning (or no text if no space); returning to sufficient size restores the frame. Only one timer advances the game.
- **Testing handoffs:** Piece generation is seeded/injected; time, terminal dimensions, and input/output are independently controllable. Unit tests may construct model fixtures for boundary checks. Full production lifecycle regressions launch the actual entry point with controlled external inputs/time/piece generation, reaching line clear, scoring, game over, restart, and quit through legal inputs/ticks, never direct state edits or forced game-over flags. Carry deterministic sequences and expected observations between batches. Use terminal/process fakes or PTY checks for lifecycle behavior, plus actual `npm start` smoke evidence and interactive seven-colour verification at delivery.

## Reviewed execution boundaries

Execute the ordered batches without ordinary-code splits. Each ends in a committable product passing its scoped checks and prior regressions. Intermediate tasks need only scoped acceptance; final delivery checks the full seed and R01–R13.

- **B01 / T01–T05:** Geometry, rendering, collision, rotation, and nonlocking descent share one placement contract. Keep them together to avoid ambiguous geometry handoffs. Independently testable boundary: bounded executable launch and deterministic model actions, not yet timed play. Output to B02: pure renderer, piece fixtures, and placement/movement behavior.
- **B02 / T06–T09:** Lock, clear, score, and spawn/game-over share one ordered transition and correction scope. Verify progression and restart together without terminal/timer ownership. Output to B03: complete deterministic game transitions and running/game-over frames, with B01 regressions retained.
- **B03 / T10–T13:** Scheduler, input, redraw, teardown, and production verification share one session lifetime. Keep timer ownership with terminal ownership rather than splitting a partially owned session. Consume B02 actions/frames; deliver live play, timing/pause, reliable exit, documentation, and full launch-to-exit evidence. Its larger size reflects the complete live-session verification boundary, not a task-count cap.

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
      "title": "Display and placement foundation",
      "task_ids": [
        "T01",
        "T02",
        "T03",
        "T04",
        "T05"
      ],
      "depends_on": [],
      "reason": "Geometry, rendering and movement share one placement contract; bounded launch and deterministic action tests provide a verified progression handoff.",
      "split_after": []
    },
    {
      "id": "B02",
      "title": "Complete model lifecycle",
      "task_ids": [
        "T06",
        "T07",
        "T08",
        "T09"
      ],
      "depends_on": [
        "B01"
      ],
      "reason": "Lock, clear, score and spawn/game-over form one ordered transition; test progression and restart before external scheduling and terminal ownership.",
      "split_after": []
    },
    {
      "id": "B03",
      "title": "Live terminal session and verified delivery",
      "task_ids": [
        "T10",
        "T11",
        "T12",
        "T13"
      ],
      "depends_on": [
        "B02"
      ],
      "reason": "Gravity, input, redraw and cleanup share one session lifetime; verify coherent ownership and the actual launch path together with delivery documentation and evidence.",
      "split_after": []
    }
  ]
}
```

## Progress and revision notes

Initial author round: no tasks marked complete or execution state changed. Preserved the R01–R13 catalogue and frozen T01–T13 definitions. Replaced placeholder rationales and moved T10 into the session batch to keep timer/terminal ownership coherent. Added compact collaboration contracts and seed-specific colour/legal-lifecycle guidance. No review findings were supplied.
