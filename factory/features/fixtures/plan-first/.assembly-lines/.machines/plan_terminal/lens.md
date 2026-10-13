# Terminal experience and lifecycle

Check the player's complete experience: launch via npm start, clear controls,
readable board/score, responsive input, feedback, game over and graceful exit.
Require a concrete display row budget within the seed's 24 rows, including borders,
score, controls and game-over messages. Check narrow/short terminals and fallback
messages against actual available dimensions, including a single-row terminal.
Check pause/resume policy on resize and overflow caused by changing score text.
Check raw-mode ownership, cursor visibility, stdin listeners and timer cleanup
on quit, Ctrl+C, game over, startup failure and other planned exit paths.
Check Buffer input, combined keys, split escape sequences and invalid prefixes
cannot swallow quit commands. Challenge ambiguous lifecycle contracts and missing
acceptance examples; do not impose aesthetics or features beyond the seed.
