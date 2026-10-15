import { resolve } from "node:path";

export interface Options {
  run: string;
  line: string;
  seed: string;
  target: string;
  attempts: number;
  planRounds: number;
  checkLine: boolean;
}

export function optionsFrom(argv: string[]): Options {
  let run = "";
  let line = "";
  let seed = "";
  let target = "";
  let attempts = 3;
  let planRounds = 3;
  let checkLine = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--run") run = argv[++index] ?? "";
    else if (argument === "--line") line = argv[++index] ?? "";
    else if (argument === "--seed") seed = argv[++index] ?? "";
    else if (argument === "--target") target = argv[++index] ?? "";
    else if (argument === "--attempts") attempts = Number(argv[++index]);
    else if (argument === "--plan-rounds") planRounds = Number(argv[++index]);
    else if (argument === "--check-line") checkLine = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!Number.isInteger(attempts) || attempts < 1) throw new Error("--attempts must be a positive integer");
  if (!Number.isInteger(planRounds) || planRounds < 1) throw new Error("--plan-rounds must be a positive integer");
  return { run, line, seed: seed ? resolve(seed) : "", target: target ? resolve(target) : "", attempts, planRounds, checkLine };
}
