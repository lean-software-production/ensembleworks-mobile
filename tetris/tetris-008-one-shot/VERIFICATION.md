# Verification evidence

Performed in the target, without committing or editing plan/batch bookkeeping.
Existing B01 implementation and HANDOFF were preserved during this correction.
Unrelated parent-repository changes were left untouched. No plan defects identified.
Findings R11-UNKNOWN-SS3 and R11-UNKNOWN-ALT addressed: unsupported SS3 and
Alt-prefixed keys are consumed whole, including partial chunks, rather than
leaking p/q/r into controls.

## Commands and results

- Correction focused check: `node --test test/session.test.js`: 5 passed.
- Earlier `node --test test/model.test.js test/session.test.js`: 10 passed.
- `node --test test/integration.test.js`: 2 passed.
- `python3 test/pty.py`: eight actual `npm start --silent` PTY launches passed.
- Final `npm test`, after final source/test edits: **14 Node tests passed, zero
  failures**, followed by all eight PTY checks passing. Each PTY run captured
  nine bounded frames and verified restored termios, visible cursor and alternate
  screen exit. Seven quit normally (exit 0); the eighth used SIGINT.

An initial PTY test failed because its filename shadowed Python's `pty` module;
using `os.openpty()` corrected the harness. The focused and final runs above
passed after this correction.

## Requirement-to-check map

| IDs | Actual checks/source locations |
| --- | --- |
| R01 | `test/model.test.js`: empty frame, score, 20 board rows plus borders/status = 24; pure render. `test/integration.test.js`: actual npm start non-TTY exits, plain output with 24 rows. `src/render.js`, `package.json`. |
| R02 | Model test: all seven shapes have four distinct cells and valid centered spawns; seeded sources reproduce and cover seven types. All seven ANSI codes rendered. `src/model.js`. |
| R03 | Model movement test: one-column movement, repeated wall rejection, settled obstruction, no self collision, unchanged rejected state. |
| R04 | Model rotation test: all seven four-rotation cycles, distinct cells, wall/floor/settled rejection with state preservation. |
| R05 | Model movement test: exact downward step, floor/settled blocking, repeated descent leaves board unmerged. |
| R06 | Model lock test: four-cell merge with unrelated cell preserved, next-source consumption exactly once, successful movement no lock, next spawn at y=0. |
| R07 | Model clear test: 0–4 simultaneous/nonadjacent rows, stable compaction and 10×20 dimensions. Scoring test locks vertical I into 1–4 completed rows. Actual-entry fixture clears two rows through legal input. |
| R08 | Model scoring test: 100/300/500/800 awards, zero-lock/no movement points, accumulated 600, huge score bounded with restart control. Integration observes 300 on production frames. |
| R09 | Model game-over test: obstructed spawn does not overwrite, clear precedes spawn decision, inert actions, reset. Session and actual-entry integration reach game over legally, restart and verify zero score/fresh timer. |
| R10 | `test/session.test.js` with `test/helpers.js` clock: no fall at 999 ms; fall at 1000; grounded lock/spawn; pause and game over cancel timer; resume/restart create one fresh interval without catch-up. |
| R11 | Decoder tests real byte sequences, combined/split arrows, unknown input; Alt/SS3 tests cover p/q/r and parameterized SS3 at every split boundary, then valid controls. Session regressions verify combined/split Alt/SS3 preserves running and game-over states, timers and input listener before valid movement/pause/restart/quit. Actual npm-start PTYs send combined/split Alt+p/q/r followed by an arrow recovery barrier, asserting no pause, exit or extra redraw. Entry regression uses byte input for the lifecycle. PTYs use actual raw split-arrow input, rotation/drop/pause/resume/quit. `src/input.js`. |
| R12 | Session tests in-place home/clear redraw, listeners/timers/raw cleanup, idempotence, SIGINT/TERM/HUP, write failure, non-TTY, tiny warning/resize recovery. PTYs verify exact before/after termios, cursor restoration and every frame's rows/width. `src/session.js`. |
| R13 | `test/integration.test.js` forks actual `src/main.js` using `test/entry-preload.js` for terminal/time only: fall → lock → double clear/300 → game over → restart → quit. Over 150 frames checked at exactly 24 rows with no wrapping at 52 columns. No board mutation in this fixture. `README.md` documents legal sequence and launch/rules. |

## Interactive colour and launch evidence

`test/pty.py` invokes actual npm start on a 52×24 Unix PTY for each piece stream.
Observed codes: I=96, O=93, T=95, S=92, Z=91, J=94, L=33, each applied to `[]`.
ICANON/ECHO are disabled during play and the entire termios structure is restored
on exit. Input requires no Enter. Each captured frame is 24 rows, every visible
line shorter than 52 columns; no trailing newline adds a 25th row.

## Limitations

PTY verification is automated interactive-terminal evidence, not a human visual
colour-perception assessment. Tests require Unix/Python; Windows console behavior
is not verified. SIGKILL cannot be cleaned up. The complete legal lifecycle uses
controlled time and I/O through the actual entry point, while PTY launch checks
use real terminal modes/time and short interactions. No external validation or
commit is claimed.
