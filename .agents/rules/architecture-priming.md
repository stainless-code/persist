---
description: STOP and run the improve-codebase-architecture skill before structurally significant changes (new subpath entry, cross-seam imports, zero-dep core breach, growing folders)
alwaysApply: true
---

# Architecture priming

Most code changes are line-level — a backend, a codec, an option, a bug fix. They don't need architectural review. **A small minority of changes are structurally significant** and pay back compound interest if reviewed before they land. This rule fires the architecture skill on those signals only, not on every edit.

## STOP if any of these apply

- **New subpath entry** in `package.json` `exports` (a new optional peer opt-in)
- **Cross-seam import** — a subpath entry reaching into another entry's internals, or `src/` core reaching across a seam boundary
- **Zero-dep core breach** — a value import in `persist-core` / `hydration` pulling a peer dep (`seroval`, `idb-keyval`, `@tanstack/store`, `react`)
- **New shared utility** under `src/` with **3+ projected consumers**
- **Folder past ~15 files** without a public-surface convention, or a new barrel (this repo is deliberately no-barrel)
- **Moving files across seam boundaries**

For each signal: STOP and run [`improve-codebase-architecture`](../skills/improve-codebase-architecture/SKILL.md) before proceeding.

## Otherwise, proceed normally

Line-level changes **do not trigger this rule**. Use intent-triggered skills (`tdd`, `harden-pr`, etc.).

## Reference

[`improve-codebase-architecture`](../skills/improve-codebase-architecture/SKILL.md) · [`tracer-bullets`](./tracer-bullets.md) · [`docs/architecture.md`](../../docs/architecture.md)
