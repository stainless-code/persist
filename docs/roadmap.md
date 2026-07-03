# Roadmap

Forward-looking plans only — **not** a mirror of `src/`. **Doc index:** [README.md](./README.md). **Design / seams:** [architecture.md](./architecture.md). Shipped features (core, codecs, backends, TanStack adapters, React hook) live in `src/` and the root [README.md](../README.md) — not enumerated here.

---

## Next

- **Upstream TanStack Persist collaboration** — pitch the `persistSource` middleware model (structural `PersistableSource` + first-class hydration lifecycle) to the TanStack Persist maintainers as a merge target, after the stainless-code publish stabilises. Draft: [`plans/upstream-tanstack-pitch.md`](./plans/upstream-tanstack-pitch.md).

> **Shipped**
>
> - Framework-matrix tests: a vitest + jsdom + @testing-library/react suite under `tests-dom/` covers the React `useHydrated` rerender + unmount-detach path that `bun:test` can't (no DOM). `bun test ./src` and `vitest` never overlap (top-level `tests-dom/` is outside `bun test ./src`'s scope). Wired into `check` (`test:dom`) and CI (`Test (DOM)` job). See [architecture.md § Test matrix](./architecture.md#test-matrix).
> - Publish-time JSDoc tooling: `stripInternal` guard, TypeDoc site (`bun run docs:api`), `{@link}` resolution gated. See [architecture.md § Publishing & API docs](./architecture.md#publishing--api-docs).

---

## Strategy

| Layer                                   | Role                                                                                                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Core** (`persist-core` + `hydration`) | Zero-dep middleware: `persistSource`, `createStorage`, codecs, registry, hydration signal. No value imports (gate-test enforced).                          |
| **Codec / backend subpaths**            | Own their optional peer (`seroval`, `idb-keyval`); compose into `createStorage`.                                                                           |
| **Framework adapters**                  | One entry per framework (`./tanstack-store`, `./react`); each adapter is ~20 lines over `HydrationSignal` — the same shape scales to Svelte / Solid / Vue. |

## Non-goals (v1)

- **No barrel** — subpath import is the dependency opt-in; a root barrel would pull every optional peer.
- **No store lock-in** — `PersistableSource` stays structural; a `@tanstack/store`-only API would restate zustand persist.
- **No silent `maxAge` expiry** — prefs shouldn't disappear; `maxAge` is opt-in, not default-on (deliberate divergence from Query-persister defaults).
- **No async-only API** — one API; sync backends stay sync on the read path so hydration settles pre-paint when it can.
