import { pathToFileURL } from 'node:url';
import { startTerminal } from './terminal.js';

// Shared production composition; injected dependencies are only a programmatic seam.
export const startGame = startTerminal;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startGame();
}
