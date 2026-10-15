# Terminal Tetris

A playable Tetris game for the terminal. The display, including status and
controls, is 24 rows high.

## Run

Requires Node.js 18 or later.

```sh
npm start
```

Run it in an interactive terminal. If standard input or output is redirected,
`npm start` prints one complete game display and exits, which is useful for a
smoke check.

## Controls

| Key | Action |
| --- | --- |
| Arrow keys or `W`/`A`/`S`/`D` | Rotate, move left/down/right |
| Space | Hard drop |
| `Q` or Ctrl-C | Quit and restore the terminal |

Clear complete rows to score points. Gravity accelerates as the level rises;
the game ends when a new piece cannot spawn.

## Test

```sh
npm test
```

The automated suite covers gameplay (falling, locking, line clearing, scoring,
rotation boundaries, and blocked spawning), keyboard handling, terminal cleanup,
gravity, and normal/game-over display height.
