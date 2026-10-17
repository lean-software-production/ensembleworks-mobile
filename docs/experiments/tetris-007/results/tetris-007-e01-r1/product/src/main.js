import { formatFrame } from './frame.js';

// Task 1 snapshot scaffold; interactive transport is introduced separately.
process.stdout.write(formatFrame({ colour: Boolean(process.stdout.isTTY) }));
