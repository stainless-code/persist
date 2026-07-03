# Docs

Repo-wide documentation hub for `@stainless-code/persist`. The package landing page is the root [`README.md`](../README.md) (install, quick start, extensibility guide); this folder holds maintainer-facing reference and forward-looking work.

## Reference

- [`architecture.md`](./architecture.md) — the three-seam model (backend × codec × source) and entry-point layout. Brief; the full API contract lives in the JSDoc of each module.
- [`glossary.md`](./glossary.md) — ubiquitous language for the persistence domain (backend, codec, source, envelope, hydration signal, generation guard, entry).
- [`roadmap.md`](./roadmap.md) — forward-looking work only, not a mirror of `src/`.

## Lifecycle folders

- [`plans/`](./plans/) — in-flight work commits here; deleted + lifted when it ships.
- [`audits/`](./audits/) — targeted audits; closed per the lifecycle in `.agents/skills/docs-governance`.
- [`research/`](./research/) — tool / approach evaluations; closed per the lifecycle.

Each folder carries a `.gitkeep` so it stays discoverable when empty.

> **Governance:** this README follows the [`docs-governance` skill](../.agents/skills/docs-governance/SKILL.md) — repo-wide Tier B surface: cross-cutting reference + lifecycle substrate, no feature-specific rules.
