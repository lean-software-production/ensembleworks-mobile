# Verification report

Performed 2026-10-15.

## Automated gameplay and display checks

Command:

```sh
npm test
```

Result: passed — 9 tests, 0 failures. The suite deterministically covers movement and collision blocking, rotation acceptance/rejection, hard-drop locking and respawning, multi-line clearing and scoring, game-over spawning, gravity timing during movement, level-adjusted gravity after hard drop, game-over/restart timer handling, and live/game-over/restart rendering. The rendering test asserts each frame is 23 rows (within the 24-row requirement) and clears all 23 rows.

## Startup check

Command:

```sh
npm start </dev/null > /tmp/tetris-startup.out 2> /tmp/tetris-startup.err
```

Result: exited with status 1 and printed `Tetris needs an interactive terminal. Run \`npm start\` from a terminal.` to stderr, confirming the expected guard for a non-interactive terminal.

## Interactive smoke check

Command:

```sh
(sleep 1; printf 'q') | timeout 10 script -q -e -c 'npm start' /dev/null
```

Result: exited with status 0. The pseudo-terminal session started the game, accepted `q`, and its captured output contained alternate-screen enter/leave (`\x1b[?1049h` / `\x1b[?1049l`) and cursor hide/show (`\x1b[?25l` / `\x1b[?25h`) sequences.

## Limitations

Checks ran in a scripted pseudo-terminal rather than a human-operated terminal. No manual visual inspection was performed.
