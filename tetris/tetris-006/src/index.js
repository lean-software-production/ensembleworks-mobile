'use strict';

const { renderFrame } = require('./render');
const { createGame } = require('./game');

// This initial entry point deliberately prints one bounded frame. Interactive
// input and redraw behavior are added as subsequent game capabilities land.
process.stdout.write(`${renderFrame(createGame())}\n`);
