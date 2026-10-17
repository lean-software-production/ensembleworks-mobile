import { createEmptyState, renderFrame } from './render.js';

// Static launch milestone; interactive session ownership is added in later tasks.
process.stdout.write(renderFrame(createEmptyState()));
