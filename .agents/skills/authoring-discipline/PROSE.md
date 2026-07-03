# Authoring discipline — prose depth

Companion to always-on [`.agents/rules/authoring-discipline.md`](../../rules/authoring-discipline.md). Doc lifecycle: [`docs-governance`](../docs-governance/SKILL.md), [`docs-lifecycle-sweep`](../docs-lifecycle-sweep/SKILL.md).

## § Concise new prose (comments, JSDoc, docs)

**Decision test:** Could a teammate re-derive this from the code in under 30 seconds? Yes → cut it.

**Keep:** why (not what), non-obvious constraints, cross-cutting context, pointers when a relationship isn't obvious, sentinels/magic values, the rejected alternative, storage/runtime quirks (sync-vs-async read path, `instanceof Promise` gating, cross-tab identity compare).

**Cut:** file inventories, pasted signatures, restating the next line, generic library practice, duplicate facts across README/architecture/glossary.

**Comments/JSDoc:** 0 lines when self-explanatory; 1 line default; 2–3 only for irreducible gotchas; `>3 lines` → lift to `docs/` with one-line pointer. The shipped `.d.mts` should read well in hovers — `@param` / `@returns` / `@default` / `@example` carry the meaning; types stay, narrating them does not.

**Doc slimming:** full checklists in [`docs-governance`](../docs-governance/SKILL.md) (anchor preservation, existence test, anti-bloat).

## § No brittle anchors in commits

Node IDs, design-tool URLs, and screenshot links are brittle — describe the **decision** in plain English.

**Never** in source comments, JSDoc, markdown, tests, or names: design-tool product names, `node-id=`, `\d{4,5}:\d{4,5}` coordinate pairs, handoff URLs. **Never copy** anchor justifications from sibling files when adding new code.

| Don't write                                    | Write instead                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| `// Per node 8267:189359: 16/16/12/16 padding` | `// 16/16/12/16 padding — inner frame matches elevated card spec`   |
| `/** Handoff uses 13/20 medium */`             | `/** Design uses 13/20 medium — closest token is B4 (14/20) */`     |
| `it("no icon — node 8296 only ships four", …)` | `it("returns no icon — only four generic device icons in spec", …)` |

**Durable traceability:** use a GitHub issue / changeset / `docs/plans/<topic>.md` reference, not a design-tool node.

## End-of-turn sweep

Before completing a turn that touched code or docs: search the diff for brittle anchors; cut duplicated tables and narration. After a doc slim, confirm runtime invariants (sync-vs-async read path, `maxAge` default, cross-tab contract) and public-API surface still have a home ([`docs-governance`](../docs-governance/SKILL.md) slimming audit).
