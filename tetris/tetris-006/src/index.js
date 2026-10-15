'use strict';

const { emptyBoard, renderFrame } = require('./render');

// This initial entry point deliberately prints one bounded frame. Interactive
// input and redraw behavior are added as subsequent game capabilities land.
process.stdout.write(`${renderFrame({ board: emptyBoard(), score: 0 })}\n`);
