# `.agents/` — rules & skills

Source of truth for AI agent configuration. Cursor consumes via symlinks in `.cursor/rules/` and `.cursor/skills/`.

## Start here

| Question                          | Read                                                                 |
| --------------------------------- | -------------------------------------------------------------------- |
| Repo-root stub (tools / humans)   | [`AGENTS.md`](../AGENTS.md) → this README                            |
| Where files live, symlinks        | [rules/agents-first-convention.md](rules/agents-first-convention.md) |
| Tier 1 / 2 / 3 attachment modes   | [rules/agents-tier-system.md](rules/agents-tier-system.md)           |
| Authoring new rules/skills (meta) | [`writing-great-skills`](skills/writing-great-skills/SKILL.md)       |
| Past corrections                  | [`lessons.md`](lessons.md)                                           |
| What exists on disk right now     | `ls .agents/rules` · `ls .agents/skills`                             |

## Tier legend (summary)

| Tier  | Attachment            | Cost                           |
| ----- | --------------------- | ------------------------------ |
| **1** | `alwaysApply: true`   | Every turn                     |
| **2** | `globs:`              | When matching files in scope   |
| **3** | `description:` intent | When user/agent intent matches |

## Inventory (deliberate, slim)

A small library needs a small governance surface. Chosen set — 7 rules + 7 skills:

**Rules** — 6 Tier-1 (always-on): `agents-first-convention`, `tracer-bullets`, `no-bypass-hooks`, `verify-after-each-step`, `authoring-discipline`, `concise-reporting`; 1 Tier-2 (globs): `agents-tier-system`.

**Skills** — `writing-great-skills` (user-invoked meta), `grilling` (intent, design stress-test), `docs-governance` (intent, docs lifecycle), `harden-pr` (intent, branch-to-pristine), `diagnosing-bugs` (intent, hard-bug loop), `tdd` (intent, red-green-refactor), `pr-comment-fact-check` (intent, bot/reviewer triage).

Deliberate omissions (would reference tooling/structure this repo lacks, or duplicate what's already here): `codemap`, `figma-mcp`, `fallow`, `pr-default-reviewers`, `features-pattern`, `api-client`, UI-component skills (no UI), `consumer-surfaces` (no served agent-content surface); `docs-lifecycle-sweep` (depends on per-feature `docs/` subtrees this repo lacks — Tier B only here; add when the surface grows); `codebase-design` (seam/adapter vocabulary already encoded in `docs/architecture.md` for this settled lib; `harden-pr` Structure reviewer is concrete enough); `agents-tier-system` skill + `writing-agents-config` (the rule + `writing-great-skills` already cover tier authoring; would mostly duplicate). Add a rule/skill only when the repo gains the tooling it would govern — a rule referencing a nonexistent script is worse than no rule.

## Conventions

- **`-priming` suffix** when a Tier-2 rule filename ≠ skill folder name. Not currently used (no priming rules).
- **No `AGENTS.md` in skill folders** — use `FULL-GUIDE.md` or topic siblings for bulk reference. Repo root `AGENTS.md` is a thin stub only.
- **Thin rules** (~10–30 lines); depth in `SKILL.md` or siblings.

## Layout

```text
.agents/
  rules/<name>.md          → .cursor/rules/<name>.mdc (symlink)
  skills/<name>/SKILL.md   → .cursor/skills/<name> (symlink)
  lessons.md               → .cursor/rules/lessons.mdc (symlink)
```
