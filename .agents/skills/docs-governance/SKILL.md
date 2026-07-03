---
name: docs-governance
description: Repo-wide docs lifecycle — plans, audits, research, README surfaces. Use when authoring or editing any docs/**, README, or other doc-bearing folder.
---

# Docs governance

Repo-wide Tier B surface (cross-cutting reference + lifecycle substrate). This is a small library: no per-feature `docs/` subtrees, no ownership tables. **Full blueprint:** [LIFECYCLE.md](./LIFECYCLE.md).

## Quick rules

1. **Five lifecycle types** — Reference (`architecture.md`, `roadmap.md`), Roadmap (`roadmap.md`), Plan (`plans/<topic>.md`), Audit (`audits/<topic>.md`), Research (`research/<tool>.md`). New content folds into one of these; no new top-level types.
2. **Existence test** — a doc earns its place if source cites it, it carries durable policy unavailable elsewhere, it tracks open work, or it carries unique historical context. Otherwise fold + delete.
3. **Plans are deleted + lifted when work ships** — durable bits move to `architecture.md` / `roadmap.md` / a rule; the plan file dies. No "slim & keep in plans/" state.
4. **`.gitkeep`** in each lifecycle folder so it stays discoverable when empty.
5. **Anti-bloat** — don't add a rule until there's content that needs it. Density (cut what code already shows) per [`authoring-discipline`](../../rules/authoring-discipline.md); lifecycle stays in [LIFECYCLE.md](./LIFECYCLE.md).
6. **Provenance** — `docs/README.md` cites this skill in its opening; per-surface docs link, never restate the spine.

## Reference

- [`docs-lifecycle-sweep`](#) — not shipped for this repo (no accumulated docs to sweep yet). Add when the surface grows.
- [`authoring-discipline`](../../rules/authoring-discipline.md) — prose density.
