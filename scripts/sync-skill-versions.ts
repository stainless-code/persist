#!/usr/bin/env bun
// Stamp `library_version` in every skills/**/SKILL.md frontmatter to the
// current package version. Wired into the `version` script so the changesets
// "Version packages" PR carries the skill bump alongside the package bump —
// keeps `intent stale` quiet without a manual review PR per release.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const FIELD = /^( *library_version:\s*")([^"]*)(")/m;

function* walkSkillFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const nested = join(dir, entry.name);
    const skill = join(nested, "SKILL.md");
    if (existsSync(skill)) yield skill;
    yield* walkSkillFiles(nested);
  }
}

let touched = 0;
for (const file of walkSkillFiles("skills")) {
  const before = readFileSync(file, "utf8");
  const after = before.replace(FIELD, `$1${version}$3`);
  if (after !== before) {
    writeFileSync(file, after);
    touched++;
  }
}
console.log(`sync-skill-versions: ${touched} skill(s) → ${version}`);
