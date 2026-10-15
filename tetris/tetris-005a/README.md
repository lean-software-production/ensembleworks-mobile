# Terminal Tetris

Play Tetris in an interactive terminal:

```sh
npm start
```

The game uses an 18-row board and its complete display (title, board, score,
controls, and game-over prompt) occupies 23 terminal rows.

## Controls

| Key | Action |
| --- | --- |
| Left/Right arrows or `a`/`d` | Move left/right |
| Up arrow or `w` | Rotate |
| Down arrow or `s` | Soft drop |
| Space | Hard drop |
| `r` | Restart after game over |
| `q` or Ctrl-C | Quit |

The game opens in the terminal's alternate screen and restores the normal
screen and cursor when it exits.

## Development

Run the engine tests with:

```sh
npm test
```
