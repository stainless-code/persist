#!/usr/bin/env bun
// Stamp `library_version` in every skills/*/SKILL.md frontmatter to the
// current package version. Wired into the `version` script so the changesets
// "Version packages" PR carries the skill bump alongside the package bump —
// keeps `intent stale` quiet without a manual review PR per release.
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const FIELD = /^( *library_version:\s*")([^"]*)(")/m;

let touched = 0;
for (const entry of readdirSync("skills", { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const file = join("skills", entry.name, "SKILL.md");
  if (!existsSync(file)) continue;
  const before = readFileSync(file, "utf8");
  const after = before.replace(FIELD, `$1${version}$3`);
  if (after !== before) {
    writeFileSync(file, after);
    touched++;
  }
}
console.log(`sync-skill-versions: ${touched} skill(s) → ${version}`);
