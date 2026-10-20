import { renderFrame } from './render.js';

// This scoped baseline emits one readable frame and exits, including on pipes.
process.stdout.write(renderFrame());
