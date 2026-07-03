# Batch glossary scan

Full terminology extraction to [`docs/glossary.md`](../../../docs/glossary.md). For **inline** term pinning during grilling or implementation, use the main [`domain-modeling`](./SKILL.md) session flow — not this file.

## Process

1. **Scan the slice** for domain-relevant nouns, verbs, and concepts. Look at: the three seams (`StateStorage<TRaw>`, `StorageCodec<S, TRaw>`, `PersistableSource<TState>`); the persisted envelope (`StorageValue`); the hydration signal (`HydrationSignal`); the entry points and their optional peers (`package.json` `exports`); option names (`skipHydration`, `throttleMs`, `maxAge`, `buster`, `migrate`, `crossTab`, `retryWrite`); backend / codec / adapter names; JSDoc that hints at semantics.
2. **Identify problems**:
   - Same word used for different concepts (ambiguity — e.g. "store" for both source and persisted storage).
   - Different words used for the same concept (synonyms — e.g. "backend" vs "storage" vs "driver").
   - Vague or overloaded terms (e.g. "the wire type" vs `TRaw`).
   - A wire-type or option name bleeding into prose without a domain explanation.
3. **Propose a canonical glossary** with opinionated term choices.
4. **Write to `docs/glossary.md`** following the format in [GLOSSARY-ENTRY.md](./GLOSSARY-ENTRY.md). Link from [`docs/README.md`](../../../docs/README.md) and [`docs/architecture.md`](../../../docs/architecture.md) § Reference.
5. **Output a summary** inline in the conversation.

## Output format

Write the glossary file per [GLOSSARY-ENTRY.md](./GLOSSARY-ENTRY.md). **Group naturally** — by seam, lifecycle, or concern. Don't force groupings if one table is cohesive enough.

```md
# Persist — Ubiquitous Language

> Single canonical glossary for terms used across `src/` and `docs/`.
> When in doubt, this file wins. Update on the same PR that introduces a new term.

## Seams

| Term | Definition | Aliases / avoid |

## Hydration

| Term | Definition | Aliases / avoid |

## Flagged ambiguities

- "<term>" was used to mean both **<canonical-A>** and **<canonical-B>**. Recommendation: ...
```

### Groupings (illustrative)

- **Seams**: backend (`StateStorage`), codec (`StorageCodec`), source (`PersistableSource`), storage (`PersistStorage`).
- **Hydration**: hydration signal (`HydrationSignal`), `useHydrated`, sync vs async read path, SSR policy.
- **Envelope / wire**: `StorageValue`, `TRaw` (wire type), `encode` / `decode`.
- **Entry points**: subpath entry, optional peer, zero-dep core, no-barrel.
- **Options / lifecycle**: `skipHydration`, `rehydrate`, `throttleMs`, `maxAge`, `buster`, `migrate`, `crossTab`, `retryWrite`, `destroy`.

## Rules

- **Be opinionated.** When multiple words exist for the same concept, pick the best one and list the others as "aliases / avoid."
- **Flag conflicts explicitly** in § Flagged ambiguities.
- **Skip generic programming concepts** unless they have domain meaning here.
- **Skip module / class / file names** unless the name itself is the domain term (e.g. `PersistableSource` — the name IS the seam).
- **Keep definitions tight** — one sentence. Define what it IS.
- **Cite, don't paste** — link source files by path (no line numbers).

## Re-running

When invoked again on a previously-glossarised repo:

1. Read the existing `docs/glossary.md`.
2. Incorporate new terms surfaced by recent PRs.
3. Update definitions if understanding has evolved.
4. Re-flag any new ambiguities.

## Project conventions

- **File location**: `docs/glossary.md` (single, repo-root).
- **Link from**: `docs/README.md` and `docs/architecture.md` § Reference.
- **Distinct from architecture vocabulary**: `improve-codebase-architecture/LANGUAGE.md` covers architecture nouns (`module`, `seam`, `adapter`); this glossary covers persistence domain nouns.
