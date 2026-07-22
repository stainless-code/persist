---
name: persist-tanstack-store
description: Persist a @tanstack/store Store or writable Atom with @stainless-code/persist (persistStore/persistAtom). Use when persisting TanStack Store state to localStorage/sessionStorage/IndexedDB, gating UI on hydration for an async backend, or deciding persistStore vs persistSource.
license: MIT
metadata:
  type: composition
  library: "@stainless-code/persist"
  library_version: "0.4.0"
  framework: "@tanstack/store"
sources:
  - stainless-code/persist:README.md
  - stainless-code/persist:docs/architecture.md
  - stainless-code/persist:src/adapters/sources/tanstack-store.ts
---

# Persisting TanStack Store

`@stainless-code/persist/sources/tanstack-store` ships two adapters over the store-agnostic `persistSource` core: `persistStore(store, options)` for `@tanstack/store`'s `Store` (action-bearing stores included), and `persistAtom(atom, options)` for a writable `Atom`. The middleware owns the lifecycle so the store stays a plain store; the adapters are thin wrappers that supply the `PersistableSource` shape.

## When to use this skill

- You have a `@tanstack/store` `Store` (or a writable Atom) and want it to survive reload.
- You need a hydration signal to gate UI flash on async backends (IndexedDB).
- You're deciding between `persistStore` and dropping to `persistSource`.

Zustand → `persist-zustand`. Other libraries with a first-party adapter → that `persist-*` skill. Hand-rolled shapes → `persistSource`.

## Install

```bash
bun add @stainless-code/persist @tanstack/store
# only when you use a codec that needs it:
bun add seroval
```

`@tanstack/store` is an optional peer of the `/sources/tanstack-store` subpath — importing the subpath is the dep opt-in.

## Minimal wiring

```ts
import { Store } from "@tanstack/store";
import { createSerovalStorage } from "@stainless-code/persist/codecs/seroval";
import { persistStore } from "@stainless-code/persist/sources/tanstack-store";

const store = new Store({ theme: "light" });
const persist = persistStore(store, {
  name: "app:prefs:v1",
  storage: createSerovalStorage(() => localStorage),
});
```

The middleware hydrates on create, subscribes to `setState`, and writes through. `persist` is a `PersistApi` — keep the reference for `rehydrate()` / `destroy()` / `onHydrate` / `clearStorage()`.

## `persistAtom` vs `persistStore`

`persistAtom` has two opinionations `persistStore` doesn't:

- **Default `merge` REPLACES, not shallow-spreads.** Atoms commonly hold primitives (`"light"`, a number); a shallow spread of a primitive corrupts it (`{}` for a number). `persistAtom` overrides `merge` to `(persisted) => persisted`. Pass your own `merge` to restore spread-merge for object atoms. The override uses `??` (not spread order), so an explicit `merge: undefined` still gets replace-merge.
- **Throws on readonly atoms.** A computed/readonly atom has no `set`; `persistAtom` throws `[persistAtom] Cannot persist a readonly atom.` rather than silently no-op'ing. Only writable atoms are persistable.

```ts
import { createAtom } from "@tanstack/store";
import { persistAtom } from "@stainless-code/persist/sources/tanstack-store";

const theme = createAtom<"light" | "dark">("light");
const persist = persistAtom(theme, { name: "app:theme:v1" });
// hydrate REPLACES the primitive; theme.set() writes through
```

## Hydration gate

Writes are **gated until hydration settles** — a `setState` fired before the stored state is loaded will not clobber stored state with the constructor default. This is why you don't need to manually defer your first write.

- **Sync backend (localStorage):** hydration settles before first paint for stores created at module load. Caveat: `hydrate` is async and `await`s the (sync) `getItem` return, so the flag flips in a **microtask**, not synchronously — `hasHydrated()` is `false` for a brief window right after `persistStore()` returns. Module-load creation settles before React's first render; creation inside a component mount may not. No flash, no `Suspense`; `useHydrated` is still the safe way to read it.
- **Async backend (IndexedDB):** hydration settles after first paint. Gate the UI on `useHydrated` (`@stainless-code/persist/frameworks/react`) or read `persist.hasHydrated()` before rendering persisted-dependent UI.

```ts
import { toHydrationSignal } from "@stainless-code/persist";
import { useHydrated } from "@stainless-code/persist/frameworks/react";

export const prefsHydration = toHydrationSignal(persist);
// in a component:
const { hydrated } = useHydrated(prefsHydration);
```

SSR: render `hydrated: true` on the server (no storage server-side). `null` signal = no persistence = hydrated.

## Trailing-only throttle

`throttleMs` coalesces bursts (typing, dragging) into **trailing** writes. The first eligible `setState` schedules a timer of `throttleMs`; further calls within the window coalesce; when the timer fires, ONE write happens with the state read at flush time (last write wins). **The first write does NOT fire immediately** — it waits out the window. This trades first-write latency for a single-timer model (TanStack Query's persister throttle is leading+trailing; ours is trailing-only).

Not throttled: `skipPersist` removals (a reset-to-default drops the key immediately, cancelling any pending write) and the one-shot post-migrate write-back. `destroy()` flushes a pending write immediately so no coalesced state is silently dropped. Set `throttleMs` when `setState` fires at high frequency and the backend is slow (IndexedDB) or networked — and only when you can tolerate first-write latency.

## Teardown — required for non-singletons

`persistStore` subscribes to the store. For a singleton app store you can let it live for the process. For stores tied to a component/route lifetime, call `persist.destroy()` on unmount — otherwise the subscription and write timer leak and stale retries can fire after the owner is gone.

```ts
useEffect(() => {
  const persist = persistStore(store, opts);
  return () => persist.destroy();
}, [store]);
```

## Cross-tab sync

`crossTab: true` enables `storage`-event sync for `localStorage`. Pair with `onCrossTabRemove` when using `skipPersist` — it fires when another tab clears the key, so you can reset the store:

```ts
persistStore(store, {
  name,
  storage,
  crossTab: true,
  onCrossTabRemove: () => store.actions.reset(),
});
```

Caveats that bite: `sessionStorage` is per-tab — `crossTab` is meaningless there. IndexedDB has no `storage` events — bridge a `BroadcastChannel` via `crossTabEventTarget` instead.

## Schema evolution

Bump `version` in options and provide `migrate`. Payloads carry `version`; on hydrate, the middleware walks migrations to the current version before seeding the store.

```ts
persistStore(store, {
  name: "app:prefs:v1",
  storage,
  version: 2,
  migrate: (state, from) => ({ ...state, newField: "default", _v: from }),
});
```

## When to drop to `persistSource`

Use `persistSource({ getState, setState, subscribe }, opts)` directly when:

- There is no first-party `./sources/*` adapter for the store (hand-rolled atom).
- You want to control subscription timing without the adapter's opinion.
- You're building a framework adapter (the React `useHydrated` hook is the template — a thin layer over `HydrationSignal`; see its JSDoc for the subscribe contract).

See also: `persist-zustand` — same core options over zustand's `StoreApi`.

## Common mistakes

- **Gating writes manually before hydration.** Don't — the gate is built in. Manually deferring usually double-gates and drops legitimate writes.
- **`identityCodec` with a string-only backend.** `identityCodec` is for structured-clone backends (IndexedDB via `idbStateStorage`). With `localStorage` use `jsonCodec` (default) or `serovalCodec`.
- **Treating `maxAge` as on by default.** It's opt-in — prefs shouldn't silently expire. Add it only for cache-shaped state.
- **Duck-typing a `then` field as a pending read.** The read path switches on `instanceof Promise`, not thenable — so a stored value with a `then` property is safe. Don't "fix" this by awaiting thenables elsewhere.

## Backend × codec choice

| State shape        | Backend        | Codec           | Notes                                       |
| ------------------ | -------------- | --------------- | ------------------------------------------- |
| Plain JSON-able    | `localStorage` | `jsonCodec`     | default; no extra dep                       |
| `Set`/`Map`/`Date` | `localStorage` | `serovalCodec`  | needs `seroval` peer                        |
| Large / structured | IndexedDB      | `identityCodec` | structured-clone mode via `idbStateStorage` |
| Encrypted at rest  | any            | custom          | `encode`/`decode` pair over the backend     |

`createStorage(backend, codec, options)` composes any other cell.

## API surface for this skill

- `persistStore(store, options) → PersistApi` (accepts action-bearing `Store<TState, StoreActionMap>`)
- `persistAtom(atom, options) → PersistApi` (writable atoms only; throws on readonly; default `merge` replaces)
- Options: `name`, `storage`, `partialize`, `merge`, `onRehydrateStorage`, `version`, `migrate`, `skipHydration`, `skipPersist`, `crossTab`, `crossTabEventTarget`, `onCrossTabRemove`, `maxAge`, `buster`, `throttleMs`, `retryWrite`, `onError`, `registry`
- `PersistApi`: `rehydrate()`, `hasHydrated()`, `onHydrate(fn)`, `onFinishHydration(fn)`, `setOptions(partial)`, `clearStorage()`, `getOptions()`, `destroy()`

Notes: `registry` + `clearStorage()` wipe every persisted key in one `registry.clearAll()` (session-end / clear-all-on-demand). `partialize` projects `TState` to the persisted slice; `merge` combines persisted with current on hydrate (default shallow spread).

Full contracts live in the JSDoc of each module (hovers + published `.d.mts`).
