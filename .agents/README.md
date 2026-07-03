# `.agents/` — rules & skills

Source of truth for AI agent configuration. Cursor consumes via symlinks in `.cursor/rules/` and `.cursor/skills/`.

## Start here

| Question                          | Read                                                                  |
| --------------------------------- | --------------------------------------------------------------------- |
| Repo-root stub (tools / humans)   | [`AGENTS.md`](../AGENTS.md) → this README                             |
| Where files live, symlinks        | [rules/agents-first-convention.md](rules/agents-first-convention.md)  |
| Tier 1 / 2 / 3 attachment modes   | [rules/agents-tier-system.md](rules/agents-tier-system.md)            |
| Persist tier/pairing deltas       | [skills/writing-agents-config](skills/writing-agents-config/SKILL.md) |
| Authoring new rules/skills (meta) | [`writing-great-skills`](skills/writing-great-skills/SKILL.md)        |
| Past corrections                  | [`lessons.md`](lessons.md)                                            |
| What exists on disk right now     | `ls .agents/rules` · `ls .agents/skills`                              |

## Tier legend (summary)

| Tier  | Attachment            | Cost                           |
| ----- | --------------------- | ------------------------------ |
| **1** | `alwaysApply: true`   | Every turn                     |
| **2** | `globs:`              | When matching files in scope   |
| **3** | `description:` intent | When user/agent intent matches |

## Inventory

9 rules + 18 skills. Discover on disk via `ls` + the frontmatter audit in [`agents-tier-system`](rules/agents-tier-system.md) — no hardcoded name lists.

**Rules** — 7 Tier-1 (always-on): `agents-first-convention`, `tracer-bullets`, `no-bypass-hooks`, `verify-after-each-step`, `authoring-discipline`, `concise-reporting`, `architecture-priming`; plus `lessons.md`. 2 Tier-2 (globs): `agents-tier-system`, `docs-governance-priming`.

**Skills** — `writing-great-skills` (meta vocabulary), `grilling` + `grill-me` + `grill-with-docs` (design stress-test), `teach` (multi-session learning), `ask-agents` (user-only router), `improve-codebase-architecture` (seam/boundary plans), `domain-modeling` (ubiquitous language), `docs-governance` + `docs-lifecycle-sweep` (docs lifecycle), `agents-tier-system` (tier assignments), `authoring-discipline` (prose depth), `verify-after-each-step` (per-file checks), `writing-agents-config` (persist deltas), `harden-pr` (branch-to-pristine), `diagnosing-bugs` (hard-bug loop), `tdd` (red-green-refactor), `pr-comment-fact-check` (reviewer/bot triage).

## Conventions

- **`-priming` suffix** when a Tier-2 rule filename ≠ skill folder name (`docs-governance-priming` ↔ `docs-governance` + `docs-lifecycle-sweep`; `architecture-priming` ↔ `improve-codebase-architecture`).
- **No `AGENTS.md` in skill folders** — use `FULL-GUIDE.md` or topic siblings (`WORKFLOW.md`, `REFERENCE.md`, `LANGUAGE.md`, `PROSE.md`) for bulk reference. Repo root `AGENTS.md` is a thin stub only.
- **Thin rules** (~10–40 lines); depth in `SKILL.md` or siblings.

## Layout

```text
.agents/
  rules/<name>.md          → .cursor/rules/<name>.mdc (symlink)
  skills/<name>/SKILL.md   → .cursor/skills/<name> (symlink)
  lessons.md               → .cursor/rules/lessons.mdc (symlink)
```
