---
name: persist-zustand
description: Persist a zustand StoreApi with @stainless-code/persist (persistStore). Use when wiring zustand to localStorage/sessionStorage/IndexedDB, replacing zustand/middleware persist, or choosing between persistStore and persistSource for a zustand store.
license: MIT
metadata:
  type: composition
  library: "@stainless-code/persist"
  library_version: "0.4.0"
  framework: "zustand"
sources:
  - stainless-code/persist:README.md
  - stainless-code/persist:docs/architecture.md
  - stainless-code/persist:src/adapters/sources/zustand.ts
---

# Persisting zustand

`@stainless-code/persist/sources/zustand` maps zustand's `StoreApi` (`getState` / `setState` / `subscribe`) onto `persistSource`. Prefer this over zustand's built-in `persist` middleware when you want Persist's hydration gate, trailing throttle, cross-tab helpers, or the same storage/codec stack as other Persist adapters.

## When to use this skill

- You have a zustand store (`create(...)` / `StoreApi`) and want it to survive reload.
- You're migrating off `zustand/middleware`'s `persist`.
- You need async-backend hydration gating (`useHydrated`) shared with other Persist sources.

Other sources → matching `persist-*` skill. UI gate → `*-persist`.

## Install

```bash
bun add @stainless-code/persist zustand
# only when you use a codec that needs it:
bun add seroval
```

`zustand` is an optional peer of the `/sources/zustand` subpath — importing the subpath is the dep opt-in.

## Minimal wiring

```ts
import { create } from "zustand";
import { createJSONStorage } from "@stainless-code/persist";
import { persistStore } from "@stainless-code/persist/sources/zustand";

const usePrefs = create(() => ({ theme: "light" as const }));
const persist = persistStore(usePrefs, {
  name: "app:prefs:v1",
  storage: createJSONStorage(() => localStorage),
});
```

Pass the store API (`usePrefs`), not a hook call. `persist` is a `PersistApi` — keep it for `rehydrate()` / `destroy()` / `onHydrate` / `clearStorage()`.

## vs zustand/middleware `persist`

| Concern            | zustand `persist`    | `@stainless-code/persist`                            |
| ------------------ | -------------------- | ---------------------------------------------------- |
| Hydration gate     | library-specific     | built-in; pair with `useHydrated` for async backends |
| Storage / codecs   | JSON-centric helpers | `createStorage` + json / seroval / identity / custom |
| Cross-tab          | optional listeners   | `crossTab` + `crossTabEventTarget` for IDB           |
| Multi-library apps | zustand-only         | same Options / `PersistApi` across source adapters   |

Keep zustand middleware for zustand-only apps that already depend on its persist API. Switch when you want one persist stack across stores.

## Hydration gate

Writes are gated until hydration settles (same as other Persist sources). Sync backends settle in a microtask; IndexedDB needs a UI gate:

```ts
import { toHydrationSignal } from "@stainless-code/persist";
import { useHydrated } from "@stainless-code/persist/frameworks/react";

export const prefsHydration = toHydrationSignal(persist);
const { hydrated } = useHydrated(prefsHydration);
```

## Teardown — required for non-singletons

`persistStore` subscribes to the store. For route/component-scoped stores, `destroy()` on unmount.

```ts
useEffect(() => {
  const persist = persistStore(store, opts);
  return () => persist.destroy();
}, [store]);
```

## Common mistakes

- **Passing `usePrefs()` (state) instead of `usePrefs` (API).** The adapter needs `getState` / `setState` / `subscribe`.
- **Stacking zustand `persist` middleware and this adapter.** Pick one write path.
- **Gating writes manually before hydration.** The gate is built in.
- **`identityCodec` with string-only backends.** Use `jsonCodec` / `createJSONStorage` for `localStorage`; `identityCodec` is for structured-clone IDB.

## API surface for this skill

- `persistStore(store, options) → PersistApi` — `store: StoreApi<TState>`
- Options / `PersistApi`: see skill `persist`.
