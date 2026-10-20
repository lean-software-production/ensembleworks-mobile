# B01 verification

Performed in this target:

- `node --test test/foundation.test.js`: 6 tests passed, 0 failed (focused editing check).
- `npm test`: full current suite, 6 tests passed, 0 failed after final source changes.
- `npm start --silent` captured to a file: exit success; independent Python subprocess probe reported 24 rows, maximum 40 columns, no trailing newline, no ANSI in non-TTY output, and exact model-action guidance.

Requirement evidence in `test/foundation.test.js`:

| Completed scope | Actual checks |
| --- | --- |
| R01 | Pure empty-board render, 20 interior rows, borders/status, 24-row limit; exact `Model: left/right, rotate, down; no keys` assertion replaces the permissive placeholder check in both pure-render and actual npm-start output. Subprocess launch uses a timeout and checks successful bounded output. |
| R02 | Injected generation visits all seven types; four distinct cells each; centered valid spawns; visible active cells; seven unique ANSI palette codes; coloured frames remain 24 rows. |
| R03 | One-column actions, repeated travel to both walls, immutable rejection, settled obstruction and no active self-collision. |
| R04 | All seven complete four-rotation cycles, O invariance, legal distinct geometry, wall/floor/settled rejection preserving entire state. |
| R05 | Exact single-row descent, first-obstruction stopping at floor/settled cells, repeated blocked actions, unchanged grid and one generation call. |

## B02 evidence

Performed after B02 source changes: `node --test test/lifecycle.test.js` passed 8/8 focused tests; `npm test` passed the full 14/14 suite. `npm start --silent` captured successfully; independent Python inspection found 24 rows, maximum 40 columns, no ANSI in plain output.

| Completed scope | Actual checks in `test/lifecycle.test.js` |
| --- | --- |
| R06 | Direct lock copies four identities and preserves unrelated cells; repeated direct lock is inert; successful descent does not lock; obstructed progression consumes exactly one next piece at its unchanged spawn coordinates. |
| R07 | 0–4 clears; nonadjacent rows; stable survivor order; independent empty top rows; 10×20 dimensions; actual locks completing 0–4 rows. |
| R08 | Every points-table entry, accumulation to 1100, no movement/rejection/rotation/zero-clear points; huge-score ANSI/plain frames remain 24 rows and at most 40 columns. |
| R09 | Blocked spawn preserves cells, leaves no active overlap, freezes gameplay and generation; restart resets board/score/active/status; full top-row clear precedes spawn decision; running/game-over frames and model-action guidance remain bounded. |

The legal fixture test uses only horizontal moves, nonlocking descent and progression: O pieces at x=0,2,4,6,8 clear two lines for 300 points; ten central O locks then end play; restart returns a fresh game. This is model-level evidence and a B03 recipe, not a production-entry lifecycle claim. Boundary unit fixtures separately construct boards as allowed by the plan.

The above B01/B02 records describe those intermediate snapshots. B03 supersedes their startup limitations; default pure rendering retains model guidance for API compatibility, while the live session advertises actual keys.

## B03 delivery evidence

Performed after final code changes:
- `node --test test/session.test.js`: focused 5/5 passed after decoder correction.
- `npm test`: full 19/19 passed, including all 14 prior regressions, after final source/test changes.
- `python3 test/pty-smoke.py`: actual `npm start --silent` under a 24×80 PTY passed quit, Ctrl-C, pending-Escape Ctrl-C and pending-CSI Ctrl-C; canonical mode disabled during play, exact termios and cursor restored after all four exits, all seven ANSI palette codes observed during legal soft-drop play. Split private/colon CSI did not quit or pause.

| Completed scope | Actual evidence |
| --- | --- |
| R10 | `test/session.test.js`: fake clock at 499/500 ms, one-step ticks, grounded lock and new spawn, pause freezes, resume fresh interval, single timer. Production regression checks game-over stops timer and restart creates one. |
| R11 | Session test feeds real split/multiple arrow byte sequences, rotation, pause/resume, unknown input, restart/quit. Added regression checks every split of ESC[?1p, ESC[1:2q and intermediate/private CSI: no state change, redraw or exit; subsequent arrows work. Production fixture exercises controls through input events. |
| R12 | Session test checks home/erase redraw, fitting narrow warning and recovery, signal cleanup for SIGINT/SIGTERM/SIGHUP, idempotence, partial setup write failure, removed listeners and timers. Prior npm capture checks bounded non-TTY exit. Added same-chunk/split Ctrl-C tests with pending Escape/CSI prefixes check timer/listener/raw/cursor cleanup. Actual npm-start PTY checks pending-prefix interrupts and raw-mode/cursor restoration. |
| R13 | `test/support/production.mjs`, spawned by session regression, imports actual `src/main.js` with externally controlled process streams, time and random source. 304 emitted frames each exactly 24 rows and at most 40 columns. Legal gravity/keys produce fall→lock→two-line clear/300 points→central stacking/game over→restart/zero score→quit. No board edits or forced status. README covers launch, dimensions, bindings, scoring, rotation, gravity and verification. |

### SS3 finding correction (R11/R12)

After final source/test changes, reran `node --test test/session.test.js` (5/5), `npm test` (19/19), and `python3 test/pty-smoke.py` (five actual npm-start exit cases passed). `git diff --check -- .` passed.

`test/session.test.js` now checks ESC O p/q/r/A and parameterized SS3 at every chunk boundary, including same-chunk delivery: no state change, redraw or exit, with subsequent arrows working. Pending SS3 Ctrl-C is tested both within and across chunks. `src/session.js` consumes unsupported SS3 through its final byte while retaining incomplete state and out-of-band interruption. PTY smoke sends same-chunk SS3 pause/restart candidates and split ESC O q, verifies continued running without pause, then confirms ordinary controls/quit still work. Added pending-SS3 Ctrl-C exit verifies exact termios restoration and cursor visibility alongside the prior four exit cases. Full suite retains production legal lifecycle and bounded-frame evidence above.

Limitations: seven colours were verified as distinct emitted ANSI codes in an interactive PTY, not by human visual inspection of a physical emulator/theme. PTY smoke requires Python/POSIX and is run explicitly, not bundled into npm test. No plan defects found. No external validation or commit is claimed.
