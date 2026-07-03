# @stainless-code/persist

Hydration-aware persistence middleware for any reactive store — storage × codec seams, TanStack Store adapters, and a React hydration hook. Store-agnostic via a structural `PersistableSource`; every "can it do X?" is a one-line composition instead of a feature request.

## Install

```bash
bun add @stainless-code/persist
```

Each subpath owns its dependency as an **optional peer** — import only the entries you use, install the matching peer only when you do:

| Subpath                                  | Optional peer        |
| ---------------------------------------- | -------------------- |
| `@stainless-code/persist`                | none (zero-dep core) |
| `@stainless-code/persist/seroval`        | `seroval`            |
| `@stainless-code/persist/idb`            | `idb-keyval`         |
| `@stainless-code/persist/tanstack-store` | `@tanstack/store`    |
| `@stainless-code/persist/react`          | `react`              |

```bash
# only when you use the matching entry
bun add seroval idb-keyval @tanstack/store react
```

## Quick start

```ts
import { Store } from "@tanstack/store";
import { createSerovalStorage } from "@stainless-code/persist/seroval";
import { persistStore } from "@stainless-code/persist/tanstack-store";
import { toHydrationSignal } from "@stainless-code/persist";
import { useHydrated } from "@stainless-code/persist/react";

const store = new Store({ theme: "light" });
const persist = persistStore(store, {
  name: "app:prefs:v1",
  storage: createSerovalStorage(() => localStorage),
});
export const prefsHydration = toHydrationSignal(persist);

// in a component:
const { hydrated } = useHydrated(prefsHydration);
```

## Relationship to TanStack Persist / zustand persist

Both TanStack Persist and zustand persist wire a single store library to a single storage with a flat options bag. `@stainless-code/persist` is a **middleware model with a first-class hydration lifecycle**: persistence is bound to a structural `PersistableSource` (`getState`/`setState`/`subscribe`) rather than a specific store, so the same middleware persists TanStack Store, zustand, Redux, or a hand-rolled atom. Three seams — backend (`StateStorage`), codec (`StorageCodec`), source (`PersistableSource`) — make every backend × codec cell a one-line composition. The hydration lifecycle (`onHydrate` / `onFinishHydration` / `hasHydrated`, surfaced via `HydrationSignal` and `useHydrated`) gates UI flash without coupling to the store's read path, versioned `migrate` handles schema evolution, `crossTab` + `onCrossTabRemove` syncs tabs, and `retryWrite` shrinks-or-gives-up on quota errors with a write-generation guard so stale retries never clobber newer state.

---

# Extensibility guide

Persistence middleware for any `getState`/`setState`/`subscribe` store (TanStack Store adapters included), built around three seams that make every "can it do X?" a one-line answer instead of a feature request. The full API contract lives in the JSDoc of each module.

## Entry points (one subpath = one optional peer)

| Subpath                                  | Symbols                                                                                                                 | Optional peer                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `@stainless-code/persist`                | `persistSource`, `PersistApi`, `createStorage`, `jsonCodec`, `identityCodec`, registry, `HydrationSignal` (`hydration`) | none                           |
| `@stainless-code/persist/seroval`        | `serovalCodec`, `createSerovalStorage`                                                                                  | `seroval`                      |
| `@stainless-code/persist/idb`            | `idbStateStorage`, `createIdbStorage` (structured-clone mode)                                                           | `idb-keyval`                   |
| `@stainless-code/persist/tanstack-store` | `persistStore`, `persistAtom`                                                                                           | `@tanstack/store` (types only) |
| `@stainless-code/persist/react`          | `useHydrated` React hook                                                                                                | `react`                        |

No barrel — importing a subpath is the dependency opt-in.

## The three seams

**1. Backend (`StateStorage<TRaw = string>`)** — anything with `getItem`/`setItem`/`removeItem`, sync or Promise-returning, string-wire by default, generic for structured backends.

```ts
import { createSerovalStorage } from "@stainless-code/persist/seroval";
import { createIdbStorage } from "@stainless-code/persist/idb";
import { createJSONStorage } from "@stainless-code/persist";

createSerovalStorage(() => localStorage); // durable prefs
createSerovalStorage(() => sessionStorage); // per-visit state (dies with the tab)
createIdbStorage(); // IndexedDB, structured-clone mode
createJSONStorage(() => AsyncStorage); // React Native — satisfies StateStorage as-is
// custom: in-memory for tests, remote KV, encrypted wrapper — implement 3 methods
```

**2. Codec (`StorageCodec<S, TRaw = string>`)** — pure `encode`/`decode` between the persisted envelope and the backend's wire type.

```ts
import {
  jsonCodec,
  identityCodec,
  createStorage,
} from "@stainless-code/persist";
import { serovalCodec } from "@stainless-code/persist/seroval";
import { idbStateStorage } from "@stainless-code/persist/idb";

jsonCodec(); // core default — plain JSON
serovalCodec(); // Set / Map / Date / cycles, inert JSON-shaped output
identityCodec(); // structured-clone backends only — zero serialization
// custom — any pair of pure functions:
const superjsonCodec = { encode: superjson.stringify, decode: superjson.parse }; // class instances via registerCustom
const encryptedCodec = {
  encode: (v) => encrypt(JSON.stringify(v)),
  decode: (raw) => JSON.parse(decrypt(raw)),
};
```

**3. Store source (`PersistableSource`)** — structural, so the middleware persists anything reactive:

```ts
import {
  persistStore,
  persistAtom,
} from "@stainless-code/persist/tanstack-store";
import { persistSource } from "@stainless-code/persist";

persistStore(store, opts); // @tanstack/store Store
persistAtom(atom, opts); // writable Atom (replace-merge default)
persistSource({ getState, setState, subscribe }, opts); // zustand-like, redux, hand-rolled
```

Compose freely: `createStorage(backend, codec, options)` covers every backend × codec cell. **Factory policy:** codec factories take the backend as an argument; a backend earns its own factory only when it needs real adaptation (IndexedDB); everything else composes — no factory-per-combination.

## Recipes

```ts
import { createStorage } from "@stainless-code/persist";
import { idbStateStorage, createIdbStorage } from "@stainless-code/persist/idb";
import { serovalCodec } from "@stainless-code/persist/seroval";
import { persistStore } from "@stainless-code/persist/tanstack-store";

// Encryption at rest over IndexedDB
createStorage(() => idbStateStorage(), encryptedCodec, {
  clearCorruptOnFailure: true,
});

// Legacy string payloads in IDB (written by an older version)
createStorage(() => idbStateStorage(), serovalCodec());

// Namespaced IDB store away from other idb-keyval users
createIdbStorage({ store: createStore("my-db", "persist") });

// Cross-tab sync (localStorage): pair crossTab with onCrossTabRemove when using skipPersist
persistStore(store, {
  name,
  storage,
  crossTab: true,
  onCrossTabRemove: () => store.actions.reset(),
});

// Cross-tab over IDB: no storage events — bridge a BroadcastChannel via crossTabEventTarget
```

Caveats that matter per backend: async backends (IDB) can't settle hydration before first paint → gate UI on `useHydrated` (`@stainless-code/persist/react`); `sessionStorage` is per-tab (crossTab is meaningless); `identityCodec` never with string-only backends.

## Writing a framework adapter

The React hook (`@stainless-code/persist/react`) is ~20 lines over `HydrationSignal` — every adapter is the same shape. The contract (full version on `HydrationSignal`'s JSDoc): subscribe returns an idempotent unsubscribe; each subscribe call is an independent subscription; **no initial notification and no payload** — pull `isHydrated()` after attach and on every notification; transitions while detached aren't replayed (the snapshot re-read recovers); **render `hydrated: true` on the server** (no storage server-side); `null` signal = no persistence = hydrated.

```ts
import type { HydrationSignal } from "@stainless-code/persist";

// Svelte 5 sketch
export function hydratedRune(signal: HydrationSignal | null) {
  if (!signal)
    return {
      get current() {
        return true;
      },
    };
  const subscribe = createSubscriber((update) =>
    signal.subscribeHydrated(update),
  );
  return {
    get current() {
      subscribe();
      return signal.isHydrated();
    },
  };
}
```

## Lifecycle in one paragraph

`persistSource` hydrates on create (skip with `skipHydration`; `rehydrate()` is awaitable), subscribe-writes on every `setState` (gated until hydrated; optional trailing `throttleMs`), and tears down completely via `destroy()` — required for non-singleton stores. Failures route to `onError` with a phase (`write`/`hydrate`/`migrate`/`crossTab`); the console fallback is dev-only. Payloads carry `version` (→ `migrate`), `timestamp` (→ `maxAge`), and `buster`; `retryWrite` implements shrink-or-give-up on quota errors with a write-generation guard so stale retries never clobber newer state.
