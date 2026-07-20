# Roadmap

Forward-looking plans only — **not** a mirror of `src/`. **Doc index:** [README.md](./README.md). **Design / seams:** [architecture.md](./architecture.md). Shipped features live in `src/` and the root [README.md](../README.md) — not enumerated here.

---

## Next

- **Remaining ROI work** — actionable items not yet shipped: TanStack Query bridge, `examples/` workspace, real-browser + SSR + framework-runtime test matrix, React ergonomics layer, OPFS/SQLite/Cloudflare adapters, playground. Plan: [`plans/remaining-roi.md`](./plans/remaining-roi.md).
- **Upstream TanStack Persist collaboration** — pitch the `persistSource` middleware model (structural `PersistableSource` + first-class hydration lifecycle) to the TanStack Persist maintainers as a merge target, after the stainless-code publish stabilises. Draft: [`plans/upstream-tanstack-pitch.md`](./plans/upstream-tanstack-pitch.md).

---

## Strategy

| Layer                                   | Role                                                                                                                              |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Core** (`persist-core` + `hydration`) | Zero-dep middleware: `persistSource`, `createStorage`, codecs, registry, hydration signal. No value imports (gate-test enforced). |
| **Codec / backend subpaths**            | Own their optional peer (`seroval`, `idb-keyval`); compose into `createStorage`.                                                  |
| **Source adapters**                     | One entry per store library (`./sources/<lib>`); thin `persistSource` wrappers, shape-named.                                      |
| **Transport**                           | Cross-tab transport adapters (`./transport/crosstab` — BroadcastChannel bridge).                                                  |
| **Framework adapters**                  | One entry per framework (`./frameworks/<fw>`); each is ~30–45 lines over `HydrationSignal`.                                       |

## Non-goals (v1)

- **No barrel** — subpath import is the dependency opt-in; a root barrel would pull every optional peer.
- **No store lock-in** — `PersistableSource` stays structural; a `@tanstack/store`-only API would restate zustand persist.
- **No silent `maxAge` expiry** — prefs shouldn't disappear; `maxAge` is opt-in, not default-on (deliberate divergence from Query-persister defaults).
- **No async-only API** — one API; sync backends stay sync on the read path so hydration settles pre-paint when it can.
