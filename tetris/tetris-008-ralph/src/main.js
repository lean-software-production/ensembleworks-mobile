import { renderFrame } from './render.js';

import { createGame } from './model.js';

// One bounded preview until the session/input batches supply interaction.
process.stdout.write(renderFrame(createGame(), { color: Boolean(process.stdout.isTTY) }));
