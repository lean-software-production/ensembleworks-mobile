import { renderFrame } from './render.js';
import { createInitialState } from './model.js';

// Static launch milestone; interactive session ownership is added in later tasks.
process.stdout.write(renderFrame(createInitialState()));
