// External deterministic randomness for the actual npm-start PTY smoke only.
let index = 0;
Math.random = () => ((index++ % 7) + 0.5) / 7;
