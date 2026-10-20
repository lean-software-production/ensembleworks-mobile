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

B01 delivers a snapshot executable and model primitives, not interactive play. R06–R13 remain unimplemented. PTY quit/termios, interactive seven-colour inspection, live frame redraw and production legal-gameplay lifecycle checks are deferred to the session batch, where terminal resources actually exist. No validation or commit is claimed.
