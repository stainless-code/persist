---
name: persist-idb
description: Persist with IndexedDB via @stainless-code/persist/backends/idb (createIdbStorage / idbStateStorage). Use for large or structured-clone state; pair with useHydrated and BroadcastChannel cross-tab.
license: MIT
metadata:
  type: composition
  library: "@stainless-code/persist"
  library_version: "0.4.0"
  framework: "idb-keyval"
requires:
  - persist
sources:
  - stainless-code/persist:src/adapters/backends/idb.ts
---

# IndexedDB backend

This skill builds on `persist`.

`createIdbStorage` uses **structured clone** + `identityCodec` — `Set`/`Map`/`Date` work without seroval. Fully **async** → gate UI. No `storage` events → use `persist-crosstab` for multi-tab.

## Install

```bash
bun add @stainless-code/persist idb-keyval
```

Peer: `idb-keyval` `>=4.0.0`.

## Minimal wiring

```ts
import { createIdbStorage } from "@stainless-code/persist/backends/idb";

const storage = createIdbStorage<Prefs>();
```

Custom codec / encrypt: `createStorage(() => idbStateStorage(store), codec, opts)`.

## Gotchas

- **`clearCorruptOnFailure` is inert** on the default identity path (identity never throws).
- IDB missing → reject on first use (`onError` `"hydrate"`), not at construct.
- `crossTab: true` alone does nothing — need `persist-crosstab`.

## Common mistakes

- **Layering JSON/seroval on default IDB** when structured clone already covers the graph.
- **Skipping `useHydrated`.**
- **Expecting native `storage` events.**

## API surface

- `createIdbStorage(options?)` · `idbStateStorage(store?)`

See also: `persist-crosstab`; `react-persist` (or other `*-persist`); `persist`.
