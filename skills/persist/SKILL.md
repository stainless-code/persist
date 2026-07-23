---
name: persist
description: Core @stainless-code/persist concepts — persistSource, PersistOptions, PersistApi, hydration gate, throttle, cross-tab, migrate. Load before framework hydration skills or when wiring a custom PersistableSource.
license: MIT
metadata:
  type: core
  library: "@stainless-code/persist"
  library_version: "0.4.1"
sources:
  - stainless-code/persist:src/core/persist-core.ts
  - stainless-code/persist:docs/architecture.md
  - stainless-code/persist:README.md
---

# Persist

Zero-dep `persistSource(source, options)` owns hydrate → subscribe → write. First-party `./sources/*` adapters map library APIs onto `PersistableSource` (`getState` / `setState` / `subscribe`) and may add opinions (default `merge`, reducer wraps, assign vs `$patch`).

## When to use this skill

- Custom store shape (no `persist-*` adapter).
- Shared Options / `PersistApi` semantics across adapters.
- Before `react-persist` (and other framework hydration skills).

Library-specific wiring → the matching `persist-*` composition skill.

## Minimal custom source

```ts
import { createJSONStorage, persistSource } from "@stainless-code/persist";

const persist = persistSource(
  {
    getState: () => state,
    setState: (updater) => {
      state = updater(state);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return { unsubscribe: () => listeners.delete(listener) };
    },
  },
  {
    name: "app:custom:v1",
    storage: createJSONStorage(() => localStorage),
  },
);
```

## Contracts agents must not invent

- **Hydration write gate** — `setState` before hydrate settles does not clobber storage. Don't double-gate manually.
- **`throttleMs`** — trailing-only; first write waits out the window. `destroy()` flushes pending writes.
- **`maxAge`** — opt-in; prefs should not silently expire.
- **`instanceof Promise`** on reads — not thenable duck-typing.
- **`PersistDecodeRethrowError`** — decode errors that must rethrow / skip `clearCorrupt` (e.g. wrong sync/async schema lane).
- **`migrate`** — called once with `(state, fromVersion)`; multi-step chains → `createMigrationChain`.
- **Teardown** — `persist.destroy()` for non-singleton lifetimes.

## `PersistApi` (keep the reference)

`rehydrate()`, `hasHydrated()`, `onHydrate`, `onFinishHydration`, `setOptions`, `clearStorage`, `getOptions`, `destroy`.

## Hydration signal for UI

```ts
import { toHydrationSignal } from "@stainless-code/persist";

export const hydration = toHydrationSignal(persist);
// frameworks/react → useHydrated(hydration) — see react-persist
```

## Backend × codec (short)

| State              | Backend        | Helper / codec      |
| ------------------ | -------------- | ------------------- |
| JSON-able          | `localStorage` | `createJSONStorage` |
| `Set`/`Map`/`Date` | `localStorage` | seroval codec       |
| Structured clone   | IndexedDB      | `identityCodec`     |

See also: `persist-*` for sources / codecs / backends / transport; `*-persist` for UI frameworks.
