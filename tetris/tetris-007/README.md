# Terminal Tetris

Run the game from this directory:

```sh
npm start
```

Use a terminal with at least 24 rows. The game redraws in place and keeps its
complete display (title, 18-row board, score, controls, and status) within 24
rows.

## Controls

- **Left / Right arrows** or **A / D**: move
- **Up arrow** or **W**: rotate
- **Down arrow** or **S**: move down one row
- **Space**: hard drop
- **Q** or **Ctrl-C**: quit

Pieces fall automatically. Complete horizontal rows to clear them and increase
your score. When a new piece cannot enter the board, the status changes to
**Game over**; press **Q** to exit. Quitting restores the cursor and disables
raw keyboard input before returning to the shell.

## Tests

```sh
npm test
```
