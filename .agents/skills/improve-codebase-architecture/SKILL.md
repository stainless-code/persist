---
name: improve-codebase-architecture
description: Architectural exploration — seam decisions, entry-module isolation, zero-dep core gate. Plan under docs/plans/. Use when improving architecture, consolidating modules, or enforcing import boundaries.
---

# Improve Codebase Architecture

**This repo** uses plan files under `docs/plans/` instead of temp reports; vocabulary in [LANGUAGE.md](./LANGUAGE.md) is the architecture nouns. Domain terms: [`docs/glossary.md`](../../../docs/glossary.md) (persistence language: backend, codec, source, envelope, hydration signal).

Explore a slice of the codebase (a seam, an entry point, a module cluster) like an AI would, surface architectural friction, discover opportunities for improving testability and module boundaries, and propose deepening / boundary-enforcement refactors as **plan files** under `docs/plans/` (see Step 7).

A **deep module** (John Ousterhout, "A Philosophy of Software Design") has a small interface hiding a large implementation. Deep modules are more testable, more AI-navigable, and let you test at the seam instead of inside.

## Architecture vocabulary — read first

Use the terms in [LANGUAGE.md](./LANGUAGE.md) **exactly** in every suggestion this skill produces — module, interface, implementation, depth, seam, adapter, leverage, locality, deletion test. Consistent vocabulary is what stops a deepening conversation from drifting into "component / service / boundary" mush. Pass the vocabulary to every sub-agent spawned in Step 5 alongside the technical brief so designs come back named consistently.

The vocabulary is **separate from domain glossaries** — `LANGUAGE.md` covers architecture nouns (`module`, `seam`); [`docs/glossary.md`](../../../docs/glossary.md) holds canonical persistence nouns (`backend`, `codec`, `source`, `envelope`, `hydration signal`). All belong in the same conversation.

## Process

### 1. Explore the slice

Use a **read-only explore subagent** to navigate the slice naturally. Don't follow rigid heuristics — explore organically and note where you experience friction:

- Where does understanding one concept require bouncing between many small files?
- Where are modules so shallow that the interface is nearly as complex as the implementation?
- Where have pure functions been extracted just for testability, but the real bugs hide in how they're called?
- Where do tightly-coupled modules create integration risk in the seams between them?
- Which parts are untested, or hard to test (DOM-coupled when they could be `bun:test`-fast)?
- Where does a subpath entry leak its optional peer into the zero-dep core, or reach across to another entry's internals?
- Where does `src/` lack a public-surface convention — internal helpers exported from `index.ts` alongside the public API?
- Where is the **zero-dep core gate** at risk — a new import in `persist-core` / `hydration` pulling a peer dep value?

The friction you encounter IS the signal.

**Done when:** ≥3 candidates listed with cluster + dependency category.

### 2. Present candidates

Present a numbered list of opportunities. For each candidate, show:

- **Cluster**: which modules / entry points / seams are involved.
- **Why they're coupled**: shared types, call patterns, co-ownership of a concept, seam-crossing imports.
- **Dependency category**: see [REFERENCE.md](./REFERENCE.md) ("Dependency Categories"). Common cases in this repo: category 1 (in-process pure functions — most of `persist-core`, codec `encode`/`decode`); category 2 (local-substitutable — in-memory `StateStorage` test doubles, `HydrationSignal` observed without a real store).
- **Test impact**: what existing `bun:test` / `tests-dom` coverage would be replaced by boundary tests; whether a new architectural regression test (in the spirit of the zero-dep core gate test) should land alongside.
- **Boundary enforcement option**: when relevant, the oxlint rule that would codify it — see [REFERENCE.md § Boundary enforcement](./REFERENCE.md#boundary-enforcement-oxlint) (this repo uses oxlint only; do not propose `eslint-plugin-boundaries`).

Don't propose interfaces yet. Ask the user: "Which of these would you like to explore?"

### 3. User picks a candidate

### 4. Frame the problem space

Before spawning sub-agents, write a user-facing explanation of the problem space for the chosen candidate:

- The constraints any new interface / boundary rule would need to satisfy (existing import sites, the test surface, the published `.d.mts` public API, `docs/architecture.md` seam model).
- The dependencies it would need to rely on (`StateStorage<TRaw>`, `StorageCodec<S, TRaw>`, `PersistableSource<TState>`, the `HydrationSignal` observation contract, the [`docs/glossary.md`](../../../docs/glossary.md) ubiquitous language).
- A rough illustrative code sketch to make the constraints concrete — this is **not** a proposal, just a way to ground the constraints.

Show this to the user, then immediately proceed to Step 5. The user reads and thinks about the problem while the sub-agents work in parallel.

### 5. Design multiple interfaces (or boundary structures)

Spawn 3+ subagents in parallel (`generalPurpose` is usually right; `explore` if read-only). Each must produce a **radically different** design.

Prompt each sub-agent with a separate technical brief (file paths, coupling details, dependency category, what's being hidden / enforced). This brief is independent of the user-facing explanation in Step 4. Give each agent a different design constraint:

- Agent 1: "Minimize the interface — aim for 1–3 entry points max."
- Agent 2: "Maximize flexibility — support many use cases and extension (new codecs, new backends, new framework adapters)."
- Agent 3: "Optimize for the most common caller — make the default case trivial (one-line `persistSource` composition)."
- Agent 4 (when applicable): "Design around the ports & adapters pattern for a cross-boundary dependency (a new backend that owns its transport — IndexedDB, a future remote storage)."
- Agent 4 alternate (boundary-enforcement candidate): design an oxlint `overrides[]` block and post-refactor `src/` shape per [REFERENCE.md § Boundary enforcement](./REFERENCE.md#boundary-enforcement-oxlint).

Each sub-agent outputs:

1. Interface signature (types, methods, params) — or, for boundary candidates, the lint config + the post-refactor folder shape.
2. Usage example showing how callers use it.
3. What complexity it hides internally — or, for boundary candidates, which classes of import become impossible.
4. Dependency strategy (how deps are handled — see [REFERENCE.md](./REFERENCE.md)).
5. Trade-offs.

Present designs sequentially, then compare them in prose (need ≥3 sub-agent outputs before comparing).

After comparing, give your own recommendation: which design you think is strongest and why. If elements from different designs would combine well, propose a hybrid. Be opinionated — the user wants a strong read, not just a menu.

### 6. User picks an interface (or accepts recommendation)

If the choice between candidates is non-obvious — multiple designs survive the comparison, the user keeps asking "but what about X?", or the dependency graph between decisions isn't clear — drop into [`grill-with-docs`](../grill-with-docs/SKILL.md) before writing the plan. The grilling loop walks the decision tree branch-by-branch, surfaces hidden constraints, and writes resolved terminology back into [`docs/glossary.md`](../../../docs/glossary.md) inline. The plan file in Step 7 then captures decisions instead of options.

The deletion test (per [LANGUAGE.md § Principles](./LANGUAGE.md#principles)) is also worth re-running here: for each candidate, ask "if we deleted the new module 18 months from now, would the complexity it hides reappear across N callers, or just move?" If "just move", the deepening is a wash and you should pick a different candidate.

### 7. Create a plan file

The output of this skill is a **plan file** under `docs/plans/`. Pick the path based on what the refactor touches:

- **Cross-cutting / any refactor** (this repo is one surface): `docs/plans/<short-kebab-name>.md` using the template in [REFERENCE.md](./REFERENCE.md).
- **Roadmap entry**: one line under the appropriate section in [`docs/roadmap.md`](../../../docs/roadmap.md).

Write the plan, then share the file path(s) and any roadmap-link paths so the user can open them. Don't ask for review before writing.

**Done when:** plan file at path; roadmap link.

If the user explicitly asks for a GitHub issue, draft the issue body but do **not** create it directly — the user files it themselves.

**Plan-file conventions:** [REFERENCE.md § Project-specific conventions](./REFERENCE.md#project-specific-conventions).
