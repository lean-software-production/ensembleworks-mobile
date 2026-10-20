# Terminal Tetris implementation plan

## Requirements and approach

Build a terminal Tetris game in this target, launched with `npm start`. Keep the entire display—including board, borders, score, controls, and game-over text—within 24 terminal rows in every state. Do not commit from the implementation agent; the factory commits changes.

Use a testable game model separate from terminal I/O. Use a conventional 10-column, 20-row playfield and all seven tetrominoes. A practical display budget is 22 rows for the bordered playfield and two status/control rows; replace existing status text for messages rather than appending rows. No particular rotation system, scoring formula, or dependency is mandated: choose simple deterministic rules and document them. Keep the automated test command available as `npm test` (reuse any existing tooling if present).

R01–R13 below are the fixed acceptance catalogue. Execute the frozen T01–T13 tasks in order, in exactly thirteen singleton batches for this ralph configuration. Task definitions and checks are unchanged.

## Collaboration contracts (design, not progress)

These clarify handoffs within the frozen scope; they do not add task acceptance or prescribe coding structure. The doer owns implementation choices and tests; the reviewers assess the same saved plan. Each batch leaves a runnable, verified increment at its scoped acceptance, not a prematurely complete game. Final delivery checks the entire seed and catalogue.

- **Model → renderer/session:** the model owns the 10×20 settled board, active-piece geometry/type, score and play status. Rendering reads state without advancing it or consuming randomness. Settled and active cells remain separate; all accepted placements are in bounds and disjoint from settled cells. Rejected actions preserve state. T02 supplies reproducible piece generation and centered valid spawns; T03–T05 share placement semantics, not independent collision rules.
- **Minimal gameplay choices:** use a simple documented clockwise rotation (reject invalid placement; square unchanged), a simple documented line-clear points table, and one documented fixed gravity interval. The doer selects the exact geometry convention, points and interval and keeps tests/docs consistent. No wall kicks, hard drop, levels, previews or other additional features are needed. Pause freezes gameplay actions, while resume and quit remain available; restart after game over returns to a fresh running game. Choose and advertise pause/restart/quit keys alongside the required arrows.
- **Downward primitive → lock pipeline:** T05 only attempts one row and reports blocked/moved. T06 owns the composed gameplay descent: move OR lock once and spawn once, never both move and lock, and never advance the newly spawned piece in that action. T07 inserts compaction before spawn; T08 consumes that lock's clear count once; T09 resolves blocked spawn without painting an overlapping active piece. Final order is lock → clear/compact → score → attempt spawn → running/game over. Until T09, expose blocked spawn explicitly without invalid board state; do not silently overwrite it.
- **Time/randomness/I/O boundaries:** piece selection is seedable or injectable without production state mutation. T10 owns one controllable gravity source driving the composed descent action; T11 sends decoded input actions to that same game path. Pause/game over stop advancement; resume/restart start a fresh interval rather than replaying elapsed time. The session owns scheduler disposal, not a second gravity loop. Tests can supply clocks, piece sequences and terminal streams/dimensions without changing normal gameplay rules.
- **Input → session → terminal:** T11 owns chunk-aware decoding and action dispatch; unfinished arrow bytes wait for later input, and unknown sequences do not become gameplay commands. T12 completes the same session's resource lifetime: raw mode, cursor, listeners, resize handling and scheduler cleanup converge on one idempotent teardown for quit, interruption and handled failure. T10/T11 need only their scoped tests before this lifecycle completion; they must leave ownership clear for T12 rather than create competing session owners.
- **Renderer → terminal:** reserve 22 bordered board rows plus two status/control rows; running, paused and game-over messages replace those rows. Include the seed's seven distinct retro ANSI piece colours plus styled border/status, reset styles, and retain readable plain output. Integrate styling with the renderer as pieces arrive and verify all seven colours interactively at final delivery. ANSI bytes are not visible width; wrapping and a trailing newline must not create a 25th row. The session decides whether dimensions permit the frame; undersized output is a fitting warning rather than a clipped full board, and suitable resize restores rendering. Non-TTY may emit a bounded plain frame and exit. Exact minimum columns follow the chosen glyphs and controls, and are documented, not guessed independently by the renderer and session.
- **Unit fixtures → production regression:** unit tests may build focused model fixtures (for example four full rows or a blocked spawn). T13's full lifecycle instead starts fresh through the actual entry point and uses legal input/ticks with controlled randomness/I/O to reach a clear, score change and game over, then restart and quit. No board/score/status edits to force those events. It records frame bounds and terminal restoration, plus the actual `npm start` interactive or PTY smoke evidence. Production tests must not substitute a model-only harness for the launch path.

### Observable handoff examples

Existing task checks remain authoritative. Examples clarify boundaries: a wall rejection consumes no piece; an unobstructed downward step neither changes settled cells nor scores; a grounded step emits one lock outcome, and the next tick addresses the new piece. A clear opening the spawn area is evaluated before declaring game over. Pause followed by several fake-clock intervals leaves gameplay unchanged, and resume waits a fresh interval. An arrow divided between chunks is one action, not unknown-character movement. A shrink below the supported size shows only a fitting warning; resize back shows the bounded frame, and quitting twice still restores the terminal once.

### Ordered batch rationale and dependencies

Each Bnn contains only Tnn, depends on its immediate predecessor (except B01), and has no split points. This is the controlled singleton policy, not a task-count optimisation; there is no runtime resource calibration. The dependency chain retains all prior contracts and verification. Each boundary is a committable scoped increment:

| Batch | Independently verifiable increment and collaboration handoff |
| --- | --- |
| B01 | Pure bounded frame and runnable/testable launch baseline; establishes renderer budget for every later state. |
| B02 | Piece geometry, deterministic source and active rendering; supplies model data to movement and colour coverage. |
| B03 | Horizontal placement safety; establishes collision contract reused by rotation/descent. |
| B04 | Rotation safety against the same board; isolates geometric correction from locking. |
| B05 | Non-locking descent primitive; supplies an explicit blocked result to progression. |
| B06 | Atomic lock/next-piece progression; exposes blocked spawn for later resolution. |
| B07 | Compaction and clear-count outcome; supplies ordered board/result to scoring and spawn checks. |
| B08 | Scoring consumes clear outcomes and renderer displays score without changing layout. |
| B09 | Blocked-spawn game over and fresh restart; supplies terminal play statuses to scheduling. |
| B10 | Fake-clock gravity and pause; establishes timer ownership for the session adapter. |
| B11 | Real key-byte dispatch into existing actions; connects playability without duplicating model logic. |
| B12 | In-place terminal presentation and lifecycle completion; verifies resource/failure boundaries before final integration. |
| B13 | Actual-launch lifecycle regression, documentation and verification report; closes whole-product and seed checks. |

## Plan revision notes (not execution progress)

Initial author revision: preserved all catalogue clauses, frozen task definitions, existing state and singleton JSON grouping. Added minimal model/render/session handoffs, deterministic test boundaries, seed colour and legal-lifecycle coverage, and per-batch rationale. No synthesis findings were supplied; no task is marked complete.

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
      "title": "Execution group 1",
      "task_ids": [
        "T01"
      ],
      "depends_on": [],
      "reason": "Reviewed execution unit for the fixed task sequence.",
      "split_after": []
    },
    {
      "id": "B02",
      "title": "Execution group 2",
      "task_ids": [
        "T02"
      ],
      "depends_on": [
        "B01"
      ],
      "reason": "Reviewed execution unit for the fixed task sequence.",
      "split_after": []
    },
    {
      "id": "B03",
      "title": "Execution group 3",
      "task_ids": [
        "T03"
      ],
      "depends_on": [
        "B02"
      ],
      "reason": "Reviewed execution unit for the fixed task sequence.",
      "split_after": []
    },
    {
      "id": "B04",
      "title": "Execution group 4",
      "task_ids": [
        "T04"
      ],
      "depends_on": [
        "B03"
      ],
      "reason": "Reviewed execution unit for the fixed task sequence.",
      "split_after": []
    },
    {
      "id": "B05",
      "title": "Execution group 5",
      "task_ids": [
        "T05"
      ],
      "depends_on": [
        "B04"
      ],
      "reason": "Reviewed execution unit for the fixed task sequence.",
      "split_after": []
    },
    {
      "id": "B06",
      "title": "Execution group 6",
      "task_ids": [
        "T06"
      ],
      "depends_on": [
        "B05"
      ],
      "reason": "Reviewed execution unit for the fixed task sequence.",
      "split_after": []
    },
    {
      "id": "B07",
      "title": "Execution group 7",
      "task_ids": [
        "T07"
      ],
      "depends_on": [
        "B06"
      ],
      "reason": "Reviewed execution unit for the fixed task sequence.",
      "split_after": []
    },
    {
      "id": "B08",
      "title": "Execution group 8",
      "task_ids": [
        "T08"
      ],
      "depends_on": [
        "B07"
      ],
      "reason": "Reviewed execution unit for the fixed task sequence.",
      "split_after": []
    },
    {
      "id": "B09",
      "title": "Execution group 9",
      "task_ids": [
        "T09"
      ],
      "depends_on": [
        "B08"
      ],
      "reason": "Reviewed execution unit for the fixed task sequence.",
      "split_after": []
    },
    {
      "id": "B10",
      "title": "Execution group 10",
      "task_ids": [
        "T10"
      ],
      "depends_on": [
        "B09"
      ],
      "reason": "Reviewed execution unit for the fixed task sequence.",
      "split_after": []
    },
    {
      "id": "B11",
      "title": "Execution group 11",
      "task_ids": [
        "T11"
      ],
      "depends_on": [
        "B10"
      ],
      "reason": "Reviewed execution unit for the fixed task sequence.",
      "split_after": []
    },
    {
      "id": "B12",
      "title": "Execution group 12",
      "task_ids": [
        "T12"
      ],
      "depends_on": [
        "B11"
      ],
      "reason": "Reviewed execution unit for the fixed task sequence.",
      "split_after": []
    },
    {
      "id": "B13",
      "title": "Execution group 13",
      "task_ids": [
        "T13"
      ],
      "depends_on": [
        "B12"
      ],
      "reason": "Reviewed execution unit for the fixed task sequence.",
      "split_after": []
    }
  ]
}
```
