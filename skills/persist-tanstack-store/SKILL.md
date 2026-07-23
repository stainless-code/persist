---
name: persist-tanstack-store
description: Persist a @tanstack/store Store or writable Atom with @stainless-code/persist (persistStore/persistAtom). Use when wiring TanStack Store to storage, or choosing persistAtom replace-merge vs persistStore.
license: MIT
metadata:
  type: composition
  library: "@stainless-code/persist"
  library_version: "0.4.0"
  framework: "@tanstack/store"
requires:
  - persist
sources:
  - stainless-code/persist:src/adapters/sources/tanstack-store.ts
---

# Persisting TanStack Store

Thin adapters over `persistSource` — shared Options / gate / throttle / cross-tab live in skill `persist`.

`persistStore(store, options)` for `Store` (action-bearing included). `persistAtom(atom, options)` for a writable `Atom`.

## Install

```bash
bun add @stainless-code/persist @tanstack/store
# Set/Map/Date on string-wire backends:
bun add seroval
```

`@tanstack/store` is an optional peer of `/sources/tanstack-store`.

## Minimal wiring

```ts
import { Store } from "@tanstack/store";
import { createJSONStorage } from "@stainless-code/persist";
import { persistStore } from "@stainless-code/persist/sources/tanstack-store";

const store = new Store({ theme: "light" });
const persist = persistStore(store, {
  name: "app:prefs:v1",
  storage: createJSONStorage(() => localStorage),
});
```

`Set`/`Map`/`Date` → `createSerovalStorage` from `/codecs/seroval` (see `persist-seroval`).

Keep the `PersistApi` for `rehydrate()` / `destroy()` / `onHydrate` / `clearStorage()`. Non-singletons must `destroy()` on teardown.

## `persistAtom` vs `persistStore`

`persistAtom` only:

- **Default `merge` REPLACES** (`(persisted) => persisted`) — shallow-spreading a primitive corrupts it. Override uses `??`, so `merge: undefined` still replace-merges.
- **Throws on readonly atoms** — `"[persistAtom] Cannot persist a readonly atom."`

```ts
import { createAtom } from "@tanstack/store";
import { persistAtom } from "@stainless-code/persist/sources/tanstack-store";

const theme = createAtom<"light" | "dark">("light");
persistAtom(theme, { name: "app:theme:v1" });
```

## When to drop to `persistSource`

- No first-party adapter for the store shape.
- You need subscription timing without the adapter's opinions.

Zustand → `persist-zustand`. UI gate → `react-persist` (or other `*-persist`).

## API surface

- `persistStore(store, options) → PersistApi`
- `persistAtom(atom, options) → PersistApi` (writable only; replace-merge default)
