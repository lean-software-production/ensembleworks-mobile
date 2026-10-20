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

R10–R13 remain unimplemented: startup is still a one-frame snapshot. PTY quit/termios, interactive seven-colour inspection, live redraw and production legal-gameplay lifecycle checks remain B03 work, where terminal resources will exist. No plan defects found; no validation or commit is claimed.
