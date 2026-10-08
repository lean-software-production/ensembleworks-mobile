// Scores every function in the target with the CRAP metric:
//   complexity² × (1 − coverage)³ + complexity
// Complexity comes from ESLint's complexity rule, coverage from c8.
// As a machine (-p) it is a ratchet: it rejects work that fails the tests,
// worsens a function, adds one above the limit or lowers coverage, and records
// the new scores in quality/crap.json when it is satisfied.
// With --report it only prints the scores.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { Linter } from "eslint";

const here = dirname(fileURLToPath(import.meta.url));
const target = process.cwd();
const config = JSON.parse(readFileSync(join(here, "machine.json"), "utf8"));
const limit = config.crapLimit ?? 30;
const minCoverage = config.minCoverage ?? 80;
const baselinePath = join(target, "quality", "crap.json");
const reportOnly = process.argv.includes("--report");
const notProduct = [
  "node_modules/**", ".assembly-lines/**", "coverage/**", "quality/**", "test/**", "tests/**",
  "**/__tests__/**", "**/*.test.*", "**/*.spec.*", "**/*.config.*"
];
const round = (value) => Math.round(value * 100) / 100;

function runTests() {
  const manifest = join(target, "package.json");
  const pkg = existsSync(manifest) ? JSON.parse(readFileSync(manifest, "utf8")) : {};
  const hasTests = Boolean(pkg.scripts?.test);
  const out = mkdtempSync(join(tmpdir(), "crap-"));
  // Without a test script nothing is covered; c8 --all still lists every file.
  const command = hasTests ? ["npm", "test", "--silent"] : [process.execPath, "-e", ""];
  const run = spawnSync(process.execPath, [
    join(here, "node_modules", "c8", "bin", "c8.js"), "--all", "--reporter=json",
    "--reports-dir", out, "--temp-directory", join(out, "v8"),
    ...notProduct.flatMap((glob) => ["--exclude", glob]), ...command
  ], { cwd: target, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const file = join(out, "coverage-final.json");
  const coverage = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  rmSync(out, { recursive: true, force: true });
  return { hasTests, passed: run.status === 0, output: `${run.stdout}${run.stderr}`, coverage, sourceType: pkg.type === "module" ? "module" : "commonjs" };
}

const functionTypes = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);
function functionsIn(node, keys, owner, found) {
  if (!node || typeof node.type !== "string") return found;
  if (node.type === "ClassDeclaration" || node.type === "ClassExpression") owner = node.id?.name ?? owner;
  if (functionTypes.has(node.type)) found.push({ node, owner });
  for (const key of keys[node.type] ?? []) {
    for (const child of [node[key]].flat()) functionsIn(child, keys, owner, found);
  }
  return found;
}

function scoreFile(path, fileCoverage, sourceType) {
  const file = relative(target, path);
  const linter = new Linter({ cwd: target, configType: "flat" });
  const messages = linter.verify(readFileSync(path, "utf8"), [{
    languageOptions: { ecmaVersion: "latest", sourceType: path.endsWith(".mjs") ? "module" : sourceType },
    rules: { complexity: ["error", { max: 0 }] }
  }], { filename: file });
  const broken = messages.find((message) => message.fatal);
  if (broken) throw new Error(`${file}:${broken.line} cannot be parsed: ${broken.message}`);
  const source = linter.getSourceCode();
  const candidates = functionsIn(source.ast, source.visitorKeys, undefined, []);
  const statements = Object.entries(fileCoverage.statementMap ?? {})
    .map(([id, location]) => ({ line: location.start.line, covered: fileCoverage.s[id] > 0 }));
  const scored = [];
  for (const message of messages) {
    const said = message.message.match(/^(.+?) has a complexity of (\d+)/);
    if (!said) continue;
    // The rule reports a function's head; its body is the first to start after that.
    const head = source.getIndexFromLoc({ line: message.line, column: message.column - 1 });
    const found = candidates.filter((candidate) => candidate.node.body.range[0] >= head)
      .sort((a, b) => a.node.body.range[0] - b.node.body.range[0])[0];
    if (!found) continue;
    const { start, end } = found.node.loc;
    const inside = statements.filter((statement) => statement.line >= start.line && statement.line <= end.line);
    const coverage = inside.length ? inside.filter((statement) => statement.covered).length / inside.length : 1;
    const complexity = Number(said[2]);
    const label = said[1].match(/'(.+)'/)?.[1] ?? said[1].toLowerCase();
    const name = found.owner && /method|constructor|getter|setter/i.test(said[1]) ? `${found.owner}.${label}` : label;
    scored.push({
      file, name, line: start.line, complexity, coverage: Math.round(coverage * 100),
      crap: round(complexity ** 2 * (1 - coverage) ** 3 + complexity)
    });
  }
  return { scored, total: statements.length, covered: statements.filter((statement) => statement.covered).length };
}

function measure() {
  const tests = runTests();
  const functions = {};
  let total = 0;
  let covered = 0;
  for (const path of Object.keys(tests.coverage).filter((path) => /\.[cm]?js$/.test(path)).sort()) {
    const file = scoreFile(path, tests.coverage[path], tests.sourceType);
    total += file.total;
    covered += file.covered;
    for (const scoredFunction of file.scored) {
      // Names identify functions across edits; line numbers would not survive them.
      let key = `${scoredFunction.file}:${scoredFunction.name}`;
      for (let copy = 2; key in functions; copy += 1) key = `${scoredFunction.file}:${scoredFunction.name}#${copy}`;
      functions[key] = scoredFunction;
    }
  }
  return { tests, functions, coverage: total ? round(covered / total * 100) : 0 };
}

function goal(measured) {
  const over = Object.values(measured.functions).filter((scored) => scored.crap > limit).length;
  return { over, met: over === 0 && measured.coverage >= minCoverage && measured.tests.hasTests && measured.tests.passed };
}

function report(measured) {
  const rows = Object.entries(measured.functions).sort(([, a], [, b]) => b.crap - a.crap);
  console.log(`Goal: no function above CRAP ${limit}, test coverage of at least ${minCoverage}%, and passing tests run by \`npm test\`.`);
  console.log(`Tests: ${measured.tests.hasTests ? (measured.tests.passed ? "passing" : "FAILING") : "none (no test script in package.json)"}. Coverage: ${measured.coverage}%.`);
  console.log("\n  CRAP  complexity  coverage  function");
  for (const [key, scored] of rows) {
    console.log(`${String(scored.crap).padStart(6)}  ${String(scored.complexity).padStart(10)}  ${String(scored.coverage + "%").padStart(8)}  ${key} (line ${scored.line})${scored.crap > limit ? "  <- above the limit" : ""}`);
  }
  const { over, met } = goal(measured);
  console.log(`\n${over} of ${rows.length} functions are above the limit. Goal met: ${met ? "yes" : "no"}.`);
}

function gate(measured) {
  const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : undefined;
  const findings = [];
  if (measured.tests.hasTests && !measured.tests.passed) {
    findings.push({ issue: "The tests fail. Behaviour must be preserved.", output: measured.tests.output.slice(-2000) });
  }
  if (baseline?.tests && !measured.tests.hasTests) findings.push({ issue: "package.json no longer has a test script." });
  for (const [key, scored] of Object.entries(measured.functions)) {
    const before = baseline?.functions[key];
    const facts = `complexity ${scored.complexity}, coverage ${scored.coverage}%`;
    if (before && scored.crap > before.crap + 0.01) {
      findings.push({ file: scored.file, function: scored.name, issue: `CRAP rose from ${before.crap} to ${scored.crap} (${facts}). Simplify it or cover it with tests.` });
    } else if (baseline && !before && scored.crap > limit) {
      findings.push({ file: scored.file, function: scored.name, issue: `This new function scores CRAP ${scored.crap}, above the limit of ${limit} (${facts}). Simplify it or cover it with tests.` });
    }
  }
  if (baseline && measured.coverage < baseline.coverage - 0.01) {
    findings.push({ issue: `Test coverage fell from ${baseline.coverage}% to ${measured.coverage}%.` });
  }
  const satisfied = findings.length === 0;
  if (satisfied) {
    mkdirSync(dirname(baselinePath), { recursive: true });
    writeFileSync(baselinePath, JSON.stringify({
      limit, minCoverage, tests: measured.tests.hasTests, coverage: measured.coverage,
      functions: Object.fromEntries(Object.entries(measured.functions)
        .map(([key, { complexity, coverage, crap }]) => [key, { crap, complexity, coverage }]))
    }, null, 2) + "\n");
  }
  const worst = Math.max(0, ...Object.values(measured.functions).map((scored) => scored.crap));
  console.log(JSON.stringify({ satisfied, findings, worstCrap: worst, coverage: measured.coverage, aboveLimit: goal(measured).over, goalMet: goal(measured).met }));
}

try {
  // The factory supplies a prompt on stdin; a tool has no use for it but must not leave it unread.
  if (!reportOnly && !process.stdin.isTTY) readFileSync(0);
  const measured = measure();
  if (reportOnly) report(measured);
  else gate(measured);
} catch (error) {
  const issue = error instanceof Error ? error.message : String(error);
  // Code that cannot be measured goes back to whoever wrote it, as any finding does.
  if (!reportOnly) console.log(JSON.stringify({ satisfied: false, findings: [{ issue }] }));
  else {
    console.error(issue);
    process.exit(1);
  }
}
