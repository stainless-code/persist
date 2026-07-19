---
name: product-tenets
description: The product north-star — four tenets (open & agnostic, composable primitives, production-grade, predictable & type-safe) distilled from TanStack's ethos/tenets. Use when making a design, API, or architecture decision, evaluating a trade-off, justifying a feature, or writing/reviewing a docs/plans entry.
---

# Product tenets (north-star)

Distilled from [TanStack's ethos](https://tanstack.com/ethos) and [product tenets](https://tanstack.com/tenets) — a great inspiration whose work we respect and learn from. These four tenets are the design north-star for `@stainless-code/persist`; reach for them whenever a decision needs justifying. Adopted and adapted to a single-package, zero-dep-core, seam-layered persistence middleware.

## 1. Open, independent, technology-agnostic

A store-agnostic core; integrations layered on top as optional adapters — never the foundation. Swapping a store library, storage backend, or serializer is a subpath swap, not a rewrite; framework-specific hydration lives in `./frameworks/*`.

- Rules out: store-biased APIs or peer deps in `src/core/` (the zero-dep gate); "all-in on zustand/TanStack Store" assumptions; lock-in that forces a rewrite when the app changes stores.
- Persist shape: one package, subpath exports per seam (backends / codecs / sources / frameworks / transport), optional peers, structural `PersistableSource`.

## 2. Composable, platform-aligned primitives

Focused, composable building blocks that embrace the web platform rather than hiding it. Adoptable one piece at a time — no rewrites, no hard coupling. Escape hatches by design: always possible to drop down a level (`persistSource` + hand-rolled `StateStorage` / `StorageCodec`).

- Rules out: designs requiring full rewrites or "all-in" commitments; heavy global singletons; abstractions that hide `localStorage` / IndexedDB / WebCrypto without escape routes.
- Persist shape: three seams — backend (`StateStorage`), codec (`StorageCodec`), source (`PersistableSource`); `createStorage(backend, codec)` composition; wrappers (`encrypted`, `compressed`) stack; `PersistRegistry` is opt-in clear-all, not required.

## 3. Pragmatic, production-grade quality

Designed around real-world workloads, edge cases, and long-lived apps — not happy-path demos. Features are not done until we'd run them in our own revenue-critical apps. Performance and reliability are requirements, not nice-to-haves.

- Rules out: demo-only features; magic that's impossible to debug; changes that optimize for benchmarks over real-world reliability (quota, multi-tab, schema evolution, hydrate flash).
- Persist shape: first-class `HydrationSignal`; versioned `migrate`; `crossTab` + `onCrossTabRemove`; `retryWrite` with write-generation guard; `throttleMs` / `maxAge` / `buster`; `onError` with phase.

## 4. Predictable, explicit, type-safe behavior

Minimal magic, maximum clarity. State, side effects, and data flow understandable from code, not hidden behavior. Type safety guides correct use without drowning users in generics. Evolve carefully with clear migration paths.

- Rules out: hidden global state or surprising side effects; API churn without migration docs; type signatures technically correct but unusable in practice.
- Persist shape: explicit options bag; structural options (`registry`, `crossTab`, …) fixed at create time; SSR policy documented (`hydrated = true` on server); pre-1.0 — prefer the cleanest correct design, document breaks in minors.

## Using the tenets

When a proposal conflicts with a tenet, explicitly address why and how the conflict is justified (a `docs/plans/` entry for new surface, inline for a line-level change). Maintainers use these as a PR checklist; partners may not bias core toward a store or framework.

## Competitor framing (docs)

Peers for comparison / migration are **store persist middlewares** (zustand-persist, redux-persist, pinia-persist). Query-cache persisters are a different problem space — do not treat them as Persist competitors.

## Reference

- [TanStack ethos](https://tanstack.com/ethos) · [TanStack product tenets](https://tanstack.com/tenets) — inspiration, with respect.
- [`architecture-priming`](../../rules/architecture-priming.md) — STOP signals for structurally significant changes.
- [`improve-codebase-architecture`](../improve-codebase-architecture/SKILL.md) · [`docs/architecture.md`](../../../docs/architecture.md)
- [`docs-voice`](../docs-voice/SKILL.md) — public docs tone.
