---
name: docs-lifecycle-sweep
description: Docs lifecycle sweep — Tier-B classification with evidence for stale docs. Use when user says doc sweep, clean up stale docs, compact audits, doc janitor, or promote/lift/retire a doc.
---

# Docs lifecycle sweep — the doc janitor

[`docs-governance`](../docs-governance/SKILL.md) defines **what** every doc should be (lifecycle types, existence test, closing prescriptions, cross-reference discipline). This skill is the **how** — it walks the repo-wide `docs/` surface, applies the spec mechanically, and produces a per-file action plan the user approves before anything is touched.

The promise: at the end of a sweep, every remaining file passes the existence test, every closed plan is lifted, every closed audit is either kept-with-justification or deleted-with-knowledge-lifted, every cross-reference still resolves, and there is **no dead weight**.

## When to fire

User intent (any phrase is enough):

- "clean up stale docs" / "doc janitor" / "doc sweep"
- "audit docs lifecycle" / "compact audits" / "compact plans"
- "are these audits still earning their keep"
- "what's gone stale in `docs/`"
- "delete tombstones" / "no tombstones, please"
- "promote / lift / retire `<doc>`"
- "is this audit closed properly"
- After landing a substantive PR, asking "did anything in docs go stale because of this?"

Also fire **proactively** when:

- Closing a Plan, Audit, or Research file via [`improve-codebase-architecture`](../improve-codebase-architecture/SKILL.md) or any normal commit that ships a tracked `roadmap.md` item — the closure is a natural sweep trigger for that file's neighbours.
- A PR adds a new `docs/audits/<topic>.md` — sweep the rest of `docs/audits/` to catch anything the new audit just superseded.
- A repo-wide refactor changes paths or symbol names cited from docs (cross-reference rot risk).

## Scope (which surfaces this skill walks)

This repo is **Tier B only** — one repo-wide `docs/` surface, no per-feature subtrees, no per-shared-component READMEs. Two surfaces:

| Tier                     | Substrate              | Sweep scope                                                                                             |
| ------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------- |
| **B** — repo-wide        | `docs/` at repo root   | All 5 lifecycle types: `architecture.md`, `roadmap.md`, `glossary.md`, `audits/`, `plans/`, `research/` |
| **0** — per-tooling-area | `.agents/`, `.cursor/` | Each rule + skill — apply existence test; check Tier-1 always-on cost still earns its keep              |

Default: the user names a surface (e.g. "sweep `docs/audits/`"), and we walk just that one. If they say "sweep docs" without scope, walk all of `docs/`.

**Procedure:** [WORKFLOW.md](./WORKFLOW.md) — enumerate → existence test → classify → report → execute on approval.

## Hooking the sweep into normal workflows

The skill is **discoverable** (Tier 3) — it fires on user intent. To make it run more automatically:

- **End of every PR-closing commit** — when an agent closes a Plan or Audit (e.g. via [`improve-codebase-architecture`](../improve-codebase-architecture/SKILL.md)), it should call this skill on the affected `audits/` or `plans/` directory as the final step.
- **End of every material refactor** — when `src/` files move or symbols rename, run this skill on `docs/` to catch cross-reference rot.
- **Pre-merge hygiene** — before merging a long-lived branch, sweep the `docs/` surfaces it touches so stale claims don't land on `main`.

## Anti-patterns

- ❌ **Deleting without surfacing the classification first.** The user owns the call. The skill produces evidence; it does not unilaterally decide.
- ❌ **Slimming without grepping for cited rule numbers / section anchors.** Anchor breakage is silent and degrades over time. [`docs-governance` § 6](../docs-governance/LIFECYCLE.md#6-cross-reference-preservation) is non-negotiable.
- ❌ **Leaving tombstones.** A "this audit was closed and deleted, see commit X" pointer file IS the dead weight the sweep is supposed to eliminate. Trust `git log --follow`. A single `roadmap.md` line under "Closed audits (pointers)" is the maximum allowed surface for "this used to exist."
- ❌ **Lifting trivia.** Not every closed audit has knowledge worth lifting. If the audit's findings are 100% mechanical ("rename X to Y, delete dead file Z") and the result is visible in source, **lift nothing, delete the file.**
- ❌ **Reformatting "while we're here."** A sweep edits structure (delete / slim / lift / pointer-update). Cosmetic re-flowing of unrelated docs is a separate PR.
- ❌ **Sweeping Tier-1 rules without checking the always-on cost ledger.** A Tier-1 rule that no longer earns its always-on cost should demote to Tier 2 / Tier 3 (per [`agents-tier-system`](../../rules/agents-tier-system.md)), not get deleted outright.
- ❌ **Leaving enumerated cross-reference indexes inline after a slim or delete.** A line like _"Cited from `architecture.md`, `glossary.md`"_ in any doc is a hand-maintained index that goes stale every time the sweep runs. When you encounter one, replace it with the lookup command (`rg "<anchor>" docs/`) — the command IS the index. See [`docs-governance` § 6](../docs-governance/LIFECYCLE.md#6-cross-reference-preservation).
- ❌ **Citing specific audit / plan / research filenames as canonical examples in skills or rules.** Skills are durable; the docs they describe are mortal under this very lifecycle. **Use shape placeholders** (`<YYYY-MM-DD>-<topic>.md`, `docs/audits/<topic>.md`) and describe the **shape** of what to look for, not which file does it today. Same hazard in rules — see [authoring-discipline](../../rules/authoring-discipline.md) + [`authoring-discipline/PROSE.md`](../authoring-discipline/PROSE.md) (no mortal filename anchors).

## Reference

- [`docs-governance`](../docs-governance/SKILL.md) — the spec this skill operationalises (lifecycle types, existence test, closing prescriptions, cross-reference discipline).
- [`docs-governance-priming`](../../rules/docs-governance-priming.md) — Tier 2 priming; cites docs-governance + this skill on doc edits.
- [`improve-codebase-architecture`](../improve-codebase-architecture/SKILL.md) — natural caller; closes plans and triggers a sweep on the surrounding `plans/` folder.
- [WORKFLOW.md](./WORKFLOW.md) — 5-step procedure + output substrate.
- [`agents-tier-system`](../../rules/agents-tier-system.md) — applies when sweeping Tier 0 (`.agents/rules/`, `.agents/skills/`).
