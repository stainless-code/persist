---
name: writing-agents-config
description: Persist repo hybrid deltas for .agents/ — tiers, rule-skill pairing, repo exemplars. Use when creating or reviewing rules/skills in this repo. Read writing-great-skills first for skill vocabulary and authoring principles.
---

# Writing agents config (persist hybrid deltas)

**Read first:** [`writing-great-skills`](../writing-great-skills/SKILL.md) — invocation, information hierarchy, completion criteria, pruning, failure modes.

This repo adds **Cursor rules** (Tier 1/2/3) on top of a skills-only agent model — always-on STOP rules where cross-turn non-negotiables beat description-only triggers.

**Tier framework:** [`agents-tier-system`](../agents-tier-system/SKILL.md) · **Layout:** [`agents-first-convention`](../../rules/agents-first-convention.md).

## Attachment decision tree (persist)

1. **Every turn, non-negotiable?** → Tier 1 (`alwaysApply: true`) — **≤40 lines** STOP + pointers
2. **File-scoped pattern?** → Tier 2 (`globs:`) — thin priming; depth in paired skill
3. **Intent-only workflow?** → Tier 3 or skill-only — no always-on tax (bug diagnosis, doc sweeps)
4. **User slash-command only?** → `disable-model-invocation: true` wrapper → model skill(s)

## Pairing checklist (persist)

| Check           | Pass when                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Priming size    | Rule ~10–40L; procedures in skill or sibling                                                                            |
| Bidirectional   | Rule → skill in Reference; skill → rule where paired                                                                    |
| No duplication  | SSOT in skill; rule has STOP rows or pointers only                                                                      |
| Inventory drift | Tier-1 set discovered via the frontmatter audit in `agents-tier-system` rule — not hardcoded name lists in README/skill |
| Triggers        | Per `writing-great-skills` — one branch per intent in `description`                                                     |

## SKILL.md size tiers

Rules cap at **≤40L**; skills use progressive disclosure (`writing-great-skills` **sprawl**). Line count is a **hygiene signal**, not a hard gate — split for structure, not to hit a number.

| Lines      | Target                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------ |
| **≤60**    | Default for **new** skills                                                                       |
| **61–120** | OK for one **single-path** workflow with checkable completion criteria                           |
| **>120**   | **Audit** — review for sprawl; disclose to siblings when structure says split                    |
| **>140**   | **Split** unless an explicit bulk reference hub (`FULL-GUIDE.md`, `WORKFLOW.md`, `REFERENCE.md`) |

**Split when:** branching paths, reference encyclopedia in `SKILL.md`, **premature-completion** risk, or **sediment** — disclose to siblings (`WORKFLOW.md`, `REFERENCE.md`, `LANGUAGE.md`, `PROSE.md`).

**Don't split when:** every line is ordered steps for one branch; splitting forces a multi-file hop mid-checklist.

```bash
# Review tail (>120L) — split only when table above says so
find .agents/skills -name SKILL.md -exec sh -c 'n=$(wc -l < "$1"); [ "$n" -gt 120 ] && printf "%3d %s\n" "$n" "$1"' _ {} \;
```

## Repo exemplars

`tracer-bullets` (rule, single file), `harden-pr` (SKILL + `WORKFLOW.md` + `LEDGER.md`), `docs-governance` (SKILL + `LIFECYCLE.md`), `docs-voice` (skill + `docs-voice-priming`), `product-tenets` (skill-only), `update-docs` (skill-only, `apps/docs` sync), `minimum-diff` (user-only), `improve-codebase-architecture` (SKILL + `LANGUAGE.md` + `REFERENCE.md`), `authoring-discipline` (rule + `PROSE.md`), `verify-after-each-step` (slim rule + skill), `agents-tier-system` (rule + skill).

## User-only router

[`ask-agents`](../ask-agents/SKILL.md) — `grill-me`, `grill-with-docs`, `teach`, `writing-great-skills`, `writing-agents-config`, `minimum-diff`. Wrappers **≤10 lines**.

## Persist-specific tradeoffs

- **Tier-2 attach** — `agents-tier-system` (`.agents/rules/**`, `.agents/skills/**`, `.cursor/rules/**`, `.cursor/skills/**`); `docs-governance-priming` (`docs/**`, `.agents/**`, `.cursor/**`); `docs-voice-priming` (`apps/docs/**`) — Persist keeps voice priming (Layers is skill-only) so competitor framing auto-loads on docs edits.
- **Intent-only skills** — `improve-codebase-architecture`, `domain-modeling`, `docs-lifecycle-sweep`, `diagnosing-bugs`, `tdd`, `pr-comment-fact-check`, `harden-pr`, `update-docs`. No glob (no per-file tax).
- **Cross-skill links** — relative `../skill/SKILL.md` and sibling files resolve reliably in Cursor agents. Relative links inside `.agents/` are an **intentional delta**, not drift.
- **Small-lib surface** — no per-feature `docs/` subtrees, no UI-component skills, no API-client/codegen skills. Don't add a skill governing tooling this repo lacks (a rule referencing a nonexistent script is worse than no rule).
- **Seam vocabulary** — backends / codecs / sources / frameworks / transport; zero-dep `src/core/`; optional peers via subpath imports — see [`architecture-priming`](../../rules/architecture-priming.md) and [`product-tenets`](../product-tenets/SKILL.md).

## Anti-patterns (persist)

- ❌ Fat always-on rule with procedures (slim → skill)
- ❌ README skill inventories that drift (discover via `ls` + frontmatter audit)
- ❌ Brittle anchors in committed source ([`authoring-discipline`](../../rules/authoring-discipline.md))
- ❌ External-monorepo artifact leakage in examples — use `src/`, seams, `bun` scripts, `origin/main`
- ❌ Treating query-cache persisters as Persist competitors in docs ([`docs-voice`](../docs-voice/SKILL.md))

## Reference

- Skill authoring SSOT: [`writing-great-skills`](../writing-great-skills/SKILL.md)
- Tiers + audit: [`agents-tier-system`](../agents-tier-system/SKILL.md)
- Docs lifecycle: [`docs-governance`](../docs-governance/SKILL.md)
