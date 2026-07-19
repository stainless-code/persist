import fs from "node:fs";
import path from "node:path";

const TEMP_TSCONFIG = "tsconfig.lint-staged.json";

/**
 * Generates a temporary tsconfig that extends the real one but only includes
 * staged TypeScript files under `src/`, so tsgo typechecks only what's being committed.
 */
function typecheckStagedFiles(filenames) {
  const tsFiles = filenames.filter((f) => {
    const rel = path.relative(process.cwd(), f).replace(/\\/g, "/");
    return rel.startsWith("src/") && /\.tsx?$/.test(rel);
  });
  if (tsFiles.length === 0) {
    return "true";
  }
  const tsconfig = {
    extends: "./tsconfig.json",
    include: tsFiles.map((f) =>
      path.relative(process.cwd(), f).replace(/\\/g, "/"),
    ),
  };
  fs.writeFileSync(TEMP_TSCONFIG, JSON.stringify(tsconfig));
  return `bun run typecheck -p ${TEMP_TSCONFIG}`;
}

function toPosixRel(file) {
  return path.relative(process.cwd(), file).replace(/\\/g, "/");
}

/** Staged `src/` source `.ts` / `.tsx` (not `*.test.*`). */
function isSourceTsFile(file) {
  const rel = toPosixRel(file);
  if (!rel.startsWith("src/")) return false;
  if (/\.test\.tsx?$/.test(rel)) return false;
  return /\.tsx?$/.test(rel);
}

/** Co-located pair: `foo.ts` → `foo.test.ts`, `foo.tsx` → `foo.test.tsx`. */
function pairedTestPath(file) {
  const rel = toPosixRel(file);
  return rel.replace(/\.tsx$/, ".test.tsx").replace(/\.ts$/, ".test.ts");
}

/**
 * Run paired unit tests when a source file is staged without its test file.
 * Skips pairs already in the staged set (the `*.test.{ts,tsx}` globs run those).
 */
function relatedTests(filenames) {
  const staged = new Set(filenames.map(toPosixRel));
  const tests = [
    ...new Set(
      filenames
        .filter(isSourceTsFile)
        .map(pairedTestPath)
        .filter((t) => fs.existsSync(t) && !staged.has(t)),
    ),
  ];
  if (tests.length === 0) {
    return "true";
  }
  return `bun test ${tests.join(" ")}`;
}

/** Pick the test runner for staged `*.test.{ts,tsx}` by location:
 * `src/**` → bun:test (no DOM); `tests-dom/**` → the `test:dom` suite (vitest
 * via bun's runtime — invoking `vitest` directly makes lint-staged run it
 * under node, which vitest 4 doesn't support). lint-staged passes the full
 * array of matching files, so split by location and run both if needed. */
function runStagedTest(filenames) {
  const files = filenames.map(toPosixRel);
  const dom = files.some((f) => f.startsWith("tests-dom/"));
  const src = files.filter((f) => f.startsWith("src/"));
  const tasks = [];
  if (dom) tasks.push("bun run test:dom");
  if (src.length) tasks.push(`bun test ${src.join(" ")}`);
  return tasks.length > 0 ? tasks.join(" && ") : "true";
}

/** @type {import('lint-staged').Configuration} */
export default {
  "*.{js,jsx,ts,tsx,mjs,mts,cjs,cts}": ["bun run format:check", "bun run lint"],
  // `mdx` so docs commits hit format:check; `apps/docs/content/**` ignored in
  // nested oxfmtrc (oxfmt collapses `:::` fences — see Blume FAQ / lessons).
  "*.{css,json,md,mdc,mdx,html,yaml,yml}": "bun run format:check",
  "*.{ts,tsx}": [typecheckStagedFiles, relatedTests],
  "*.test.ts": runStagedTest,
  "*.test.tsx": runStagedTest,
};
