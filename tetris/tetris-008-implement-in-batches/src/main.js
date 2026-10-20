import { createState } from './model.js';
import { render } from './render.js';

// B01 snapshot only: no terminal resources or timers are acquired.
process.stdout.write(render(createState(), { color: Boolean(process.stdout.isTTY) }));
