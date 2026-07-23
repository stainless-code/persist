---
name: react-persist
description: Gate React UI on Persist hydration with useHydrated + toHydrationSignal. Use when avoiding flash of default state on async backends (IndexedDB), SSR snapshot true, or wiring HydrationSignal into React 18/19.
license: MIT
metadata:
  type: framework
  library: "@stainless-code/persist"
  library_version: "0.4.0"
  framework: "react"
requires:
  - persist
sources:
  - stainless-code/persist:src/adapters/frameworks/react.ts
  - stainless-code/persist:docs/architecture.md
---

# React hydration gate

`@stainless-code/persist/frameworks/react` exports `useHydrated(signal)` — a thin `useSyncExternalStore` wrapper over `HydrationSignal`. It does **not** persist state; pair it with a `./sources/*` adapter (`persist-zustand`, `persist-tanstack-store`, …).

## When to use this skill

- Async backend (IndexedDB) — gate UI until hydrate settles.
- SSR — server snapshot is always `hydrated: true` (nothing to wait for server-side).
- `null` / `undefined` signal → treat as hydrated (no persistence configured).

## Install

```bash
bun add @stainless-code/persist react
```

`react` `^18 || ^19` is the optional peer of `/frameworks/react`.

## Minimal wiring

```ts
// store module
import { toHydrationSignal } from "@stainless-code/persist";
import { persistStore } from "@stainless-code/persist/sources/zustand";

const persist = persistStore(store, { name: "app:prefs:v1", storage });
export const prefsHydration = toHydrationSignal(persist);
```

```tsx
// component
import { useHydrated } from "@stainless-code/persist/frameworks/react";

const { hydrated } = useHydrated(prefsHydration);
const prefs = useStore(store); // your selector — not from useHydrated
if (!hydrated) return <Skeleton />;
return <PrefsView prefs={prefs} />;
```

## Contracts

- Return shape is **only** `{ hydrated: boolean }` — read state via your store's selector.
- Gates **UI flash**, not store reads; pre-hydration `getState()` can still see defaults.
- Sync backends settle in a microtask; module-load stores usually hydrate before first paint, but `useHydrated` is still the safe read.

## Common mistakes

- **Treating `useHydrated` as the state source.** It only reports the gate.
- **Expecting `hydrated: false` on the server.** SSR snapshot is `true`.
- **Forgetting `toHydrationSignal(persist)`.** Pass a `HydrationSignal`, not `PersistApi`.
- **Assuming `null` signal means “loading”.** It means “no persist” → hydrated.

## API surface

- `useHydrated(signal: HydrationSignal | null | undefined) → { hydrated: boolean }`
- Core helper: `toHydrationSignal(persist)` from `@stainless-code/persist`

See also: the matching `persist-*` source skill for your store.
