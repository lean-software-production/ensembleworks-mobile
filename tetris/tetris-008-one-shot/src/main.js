import {startSession} from './session.js';
import {source,sequence} from './model.js';
// Optional reproducible piece stream; changes generation only, never board state.
export function main(options={}) {
  const stream=process.env.TETRIS_PIECES;
  const next=stream?sequence(stream.split('')):process.env.TETRIS_SEED!==undefined?source(process.env.TETRIS_SEED):undefined;
  return startSession({next,...options});
}
main();
