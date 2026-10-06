#!/usr/bin/env bun
// `blume validate` flags a github-releases changelog link to a non-page target
// (deployment-base self-link `/persist` from the immutable 0.2.1 release
// body); drop only that exact target.
import { spawnSync } from "node:child_process";

interface Diagnostic {
  code?: string;
  file?: string;
  message?: string;
  severity?: string;
}

interface ValidatePayload {
  diagnostics?: Diagnostic[];
}

const args = process.argv.slice(2);
if (!args.includes("--json")) {
  args.push("--json");
}

const result = spawnSync("blume", ["validate", ...args], {
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
  timeout: 120_000,
});

const stdout = result.stdout ?? "";
const stderr = result.stderr ?? "";
if (stderr) process.stderr.write(stderr);
if (result.error) {
  const timedOut = "code" in result.error && result.error.code === "ETIMEDOUT";
  process.stderr.write(
    timedOut
      ? "[validate] blume validate timed out after 120s\n"
      : `${result.error}\n`,
  );
  process.exit(1);
}

let payload: ValidatePayload;
try {
  payload = JSON.parse(stdout) as ValidatePayload;
} catch {
  process.stdout.write(stdout);
  process.exit(result.status === 0 ? 0 : 1);
}

/**
 * Exact exempt changelog link targets, enumerated 2026-10-06 via
 * `gh api repos/stainless-code/persist/releases --paginate --jq '.[].body'`:
 * zero `../docs/...` / `/docs/...` links (sole `docs` mention is backticked
 * `apps/docs` in 0.2.1). Release bodies are immutable, so the set is exact.
 * Kept as a set so a future enumeration can add exact entries here.
 */
const CHANGELOG_ALLOWED_LINK_TARGETS: ReadonlySet<string> = new Set([
  // (empty: no docs/ link targets exist in any release body)
]);

/** Exact deployment-base self-link: `/persist` (+ optional `/`), nothing under it. */
const CHANGELOG_BASE_SELF_LINK_RE = /^\/persist\/?(?![\w/-])/;

const parseChangelogLinkTarget = (message: string): string | undefined =>
  /Broken link to (\S+?):/.exec(message)?.[1];

const isChangelogFilteredLink = (d: Diagnostic): boolean => {
  if (d.code !== "BLUME_BROKEN_LINK") return false;
  if (typeof d.file !== "string" || !d.file.startsWith("changelog:"))
    return false;
  if (typeof d.message !== "string") return false;
  const target = parseChangelogLinkTarget(d.message);
  if (target === undefined) return false;
  return (
    CHANGELOG_ALLOWED_LINK_TARGETS.has(target) ||
    CHANGELOG_BASE_SELF_LINK_RE.test(target)
  );
};

const kept = (payload.diagnostics ?? []).filter(
  (d) => !isChangelogFilteredLink(d),
);
const filtered = (payload.diagnostics ?? []).length - kept.length;

const errors = kept.filter((d) => d.severity === "error").length;
const warnings = kept.filter((d) => d.severity === "warning").length;
const strict = args.includes("--strict");

process.stdout.write(
  `${JSON.stringify(
    {
      diagnostics: kept,
      summary: {
        error: errors,
        warning: warnings,
        info: kept.filter((d) => d.severity === "info").length,
        filtered_changelog_broken_links: filtered,
      },
    },
    null,
    2,
  )}\n`,
);

if (filtered > 0) {
  process.stderr.write(
    `[validate] filtered ${filtered} changelog non-page broken link(s)\n`,
  );
}

process.exit(errors > 0 || (strict && warnings > 0) ? 1 : 0);
