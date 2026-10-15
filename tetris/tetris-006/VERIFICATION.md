# Verification report

Completed for task 13 on 2026-10-15.

## Automated checks

- `npm test` — passed: 41 tests, 0 failures. This includes the entry-point
  integration regression, which starts `main` with controlled TTY I/O and clock,
  drives falling, a lock and one-line clear (score 100), game over, restart, and
  quit. It also asserts every rendered redraw frame has at most 24 rows.
- `node src/index.js | awk 'END { print NR }'` — returned `24`, confirming the
  captured entry-point game frame uses the display budget.
- `git diff --check` — passed with no whitespace errors.

## PTY smoke test

- `(sleep 1; printf 'q') | script -qec 'stty rows 24 cols 80; npm start' /dev/null`
  — exited with status 0. The captured PTY output contained one redraw prefix;
  a direct visible run with the same sized PTY showed the complete 24-row board,
  score, controls, and cursor-restoration escape sequence before exit.

This was an automated PTY smoke test, not a manual gameplay session. Terminal
emulator-specific progress output from `script` followed the program's restored
cursor sequence, so frame assertions are intentionally handled by the automated
controlled-I/O integration test rather than by parsing `script`'s transcript.
