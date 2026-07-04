# @stainless-code/persist

Hydration-aware persistence middleware for any reactive store — storage × codec seams, TanStack Store adapters, and a React hydration hook. Store-agnostic via a structural `PersistableSource`; every "can it do X?" is a one-line composition instead of a feature request.

Jump to what you need —

- [Install](#install)
- [Quick start](#quick-start)
- [What does "hydration-aware" mean?](#what-does-hydration-aware-mean)
- [IndexedDB + React, end to end](#indexeddb--react-end-to-end)
- [Relationship to TanStack Persist / zustand persist](#relationship-to-tanstack-persist--zustand-persist)
- Extensibility guide
  - [Entry points (one subpath = one optional peer)](#entry-points-one-subpath--one-optional-peer)
  - [The three seams](#the-three-seams)
  - [Recipes](#recipes)
  - [Writing a framework adapter](#writing-a-framework-adapter)
  - [Lifecycle in one paragraph](#lifecycle-in-one-paragraph)
- [API reference](#api-reference)

## Install

```bash
bun add @stainless-code/persist
```

Each subpath owns its dependency as an **optional peer** — import only the entries you use, install the matching peer only when you do:

| Subpath                                           | Optional peer                               |
| ------------------------------------------------- | ------------------------------------------- |
| `@stainless-code/persist`                         | none (zero-dep core)                        |
| `@stainless-code/persist/codecs/seroval`          | `seroval`                                   |
| `@stainless-code/persist/codecs/zod`              | `zod`                                       |
| `@stainless-code/persist/backends/idb`            | `idb-keyval`                                |
| `@stainless-code/persist/backends/async-storage`  | `@react-native-async-storage/async-storage` |
| `@stainless-code/persist/backends/mmkv`           | `react-native-mmkv`                         |
| `@stainless-code/persist/backends/secure-store`   | `expo-secure-store`                         |
| `@stainless-code/persist/transport/crosstab`      | none (web global)                           |
| `@stainless-code/persist/sources/tanstack-store`  | `@tanstack/store`                           |
| `@stainless-code/persist/frameworks/react`        | `react`                                     |
| `@stainless-code/persist/frameworks/solid`        | `solid-js`                                  |
| `@stainless-code/persist/frameworks/vue`          | `vue`                                       |
| `@stainless-code/persist/frameworks/svelte`       | `svelte`                                    |
| `@stainless-code/persist/frameworks/svelte-store` | `svelte`                                    |

```bash
# only when you use the matching entry
bun add seroval idb-keyval @tanstack/store react
```

Any package manager works — engines require Node ≥20.19 (or Bun ≥1).

```bash
npm install @stainless-code/persist   # pnpm add / yarn add — same pattern
# optional peers, only for subpaths you import:
npm install seroval idb-keyval @tanstack/store react
```

## Quick start

```ts
import { Store } from "@tanstack/store";
import { createSerovalStorage } from "@stainless-code/persist/codecs/seroval";
import { persistStore } from "@stainless-code/persist/sources/tanstack-store";
import { toHydrationSignal } from "@stainless-code/persist";
import { useHydrated } from "@stainless-code/persist/frameworks/react";

const store = new Store({ theme: "light" });
const persist = persistStore(store, {
  name: "app:prefs:v1",
  storage: createSerovalStorage(() => localStorage),
});
export const prefsHydration = toHydrationSignal(persist);

// in a component:
const { hydrated } = useHydrated(prefsHydration);
```

## What does "hydration-aware" mean?

**Hydration-aware** means the library tracks whether persisted state has **finished loading from storage** — not React SSR hydration, not rehydrating the DOM from HTML. It answers one question: _has the stored snapshot landed in the store yet?_

That gap matters on async backends. IndexedDB reads are Promise-backed; they cannot settle before first paint. Between mount and the read completing, the store still holds its constructor default — theme `"light"` when storage says `"dark"`, filters `[]` when storage has three. Render persisted-dependent UI in that window and you get a **hydrate flash**: wrong state, then a snap to the real one. `useHydrated` gates on that lifecycle; it does not change how you read state.

Sync backends (`localStorage`, `sessionStorage`) settle before first render when the store is created at module load — `hydrated` is `true` immediately, no gate required. IndexedDB makes the gate mandatory rather than optional.

```tsx
const { hydrated } = useHydrated(prefsHydration);
if (!hydrated) return <Skeleton />;
// persisted-dependent UI below
```

## IndexedDB + React, end to end

The headline path: async storage, TanStack Store, hydration gate. npm/pnpm/yarn work too.

```bash
bun add @stainless-code/persist @tanstack/store react idb-keyval
```

**Store module** — `createIdbStorage` runs structured-clone mode: `Set` / `Map` / `Date` round-trip natively, no codec. The persist + hydration signal live at module scope for an app-lifetime singleton store.

```ts
// prefs-store.ts
import { Store } from "@tanstack/store";
import { toHydrationSignal } from "@stainless-code/persist";
import { createIdbStorage } from "@stainless-code/persist/backends/idb";
import { persistStore } from "@stainless-code/persist/sources/tanstack-store";

export type Prefs = { theme: "light" | "dark"; recent: string[] };

export const prefsStore = new Store<Prefs>({ theme: "light", recent: [] });

const persist = persistStore(prefsStore, {
  name: "app:prefs:v1",
  storage: createIdbStorage<Prefs>(),
});
export const prefsHydration = toHydrationSignal(persist);
```

**React component** — `useHydrated` returns only `{ hydrated }`; state reads stay on `useSelector`. Server snapshot is always `true` (nothing to gate server-side).

```tsx
// PrefsPanel.tsx
import { useSelector } from "@tanstack/store";
import { useHydrated } from "@stainless-code/persist/frameworks/react";
import { prefsStore, prefsHydration } from "./prefs-store";

export function PrefsPanel() {
  const { hydrated } = useHydrated(prefsHydration);
  const theme = useSelector(prefsStore, (s) => s.theme);
  if (!hydrated) return <Skeleton />;
  return <ThemeToggle theme={theme} />;
}
```

**Non-singleton stores** (a per-route filter store, a per-instance draft editor) must create the persist in `useEffect` and tear it down on unmount — `destroy()` detaches the source subscription, removes the cross-tab listener, unregisters from any registry, and flushes any pending throttled write:

```tsx
useEffect(() => {
  const persist = persistStore(filtersStore, {
    name: `app:filters:${id}`,
    storage: createIdbStorage<Filters>(),
  });
  return () => persist.destroy();
}, [id]);
```

IndexedDB fires no `storage` events — `crossTab: true` alone does nothing on this backend. Cross-tab sync needs a `BroadcastChannel` bridge wired through `crossTabEventTarget` (see Recipes).

## Relationship to TanStack Persist / zustand persist

Both TanStack Persist and zustand persist wire a single store library to a single storage with a flat options bag. `@stainless-code/persist` is a **middleware model with a first-class hydration lifecycle**: persistence is bound to a structural `PersistableSource` (`getState`/`setState`/`subscribe`) rather than a specific store, so the same middleware persists TanStack Store, zustand, Redux, or a hand-rolled atom. Three seams — backend (`StateStorage`), codec (`StorageCodec`), source (`PersistableSource`) — make every backend × codec cell a one-line composition. The hydration lifecycle (`onHydrate` / `onFinishHydration` / `hasHydrated`, surfaced via `HydrationSignal` and `useHydrated`) gates UI flash without coupling to the store's read path, versioned `migrate` handles schema evolution, `crossTab` + `onCrossTabRemove` syncs tabs, and `retryWrite` shrinks-or-gives-up on quota errors with a write-generation guard so stale retries never clobber newer state.

---

# Extensibility guide

Persistence middleware for any `getState`/`setState`/`subscribe` store (TanStack Store adapters included), built around three seams that make every "can it do X?" a one-line answer instead of a feature request. The full API contract lives in the JSDoc of each module.

## Entry points (one subpath = one optional peer)

| Subpath                                           | Symbols                                                                                                                 | Optional peer                               |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `@stainless-code/persist`                         | `persistSource`, `PersistApi`, `createStorage`, `jsonCodec`, `identityCodec`, registry, `HydrationSignal` (`hydration`) | none                                        |
| `@stainless-code/persist/codecs/seroval`          | `serovalCodec`, `createSerovalStorage`                                                                                  | `seroval`                                   |
| `@stainless-code/persist/codecs/zod`              | `zodCodec`, `createZodStorage`                                                                                          | `zod`                                       |
| `@stainless-code/persist/backends/idb`            | `idbStateStorage`, `createIdbStorage` (structured-clone mode)                                                           | `idb-keyval`                                |
| `@stainless-code/persist/backends/async-storage`  | `asyncStorageStateStorage`, `createAsyncStorage`                                                                        | `@react-native-async-storage/async-storage` |
| `@stainless-code/persist/backends/mmkv`           | `mmkvStateStorage`, `createMmkvStorage`                                                                                 | `react-native-mmkv`                         |
| `@stainless-code/persist/backends/secure-store`   | `secureStoreStateStorage`, `createSecureStoreStorage`                                                                   | `expo-secure-store`                         |
| `@stainless-code/persist/transport/crosstab`      | `createBroadcastCrossTab`                                                                                               | none (web global)                           |
| `@stainless-code/persist/sources/tanstack-store`  | `persistStore`, `persistAtom`                                                                                           | `@tanstack/store` (types only)              |
| `@stainless-code/persist/frameworks/react`        | `useHydrated` React hook                                                                                                | `react`                                     |
| `@stainless-code/persist/frameworks/solid`        | `useHydrated` (Solid `Accessor<boolean>`)                                                                               | `solid-js`                                  |
| `@stainless-code/persist/frameworks/vue`          | `useHydrated` (Vue `Ref<boolean>`)                                                                                      | `vue`                                       |
| `@stainless-code/persist/frameworks/svelte`       | `hydratedRune` (Svelte 5 runes `current`)                                                                               | `svelte` (>=5)                              |
| `@stainless-code/persist/frameworks/svelte-store` | `hydratedStore` (Svelte `Readable<boolean>`)                                                                            | `svelte` (>=3)                              |

No barrel — importing a subpath is the dependency opt-in.

## The three seams

**1. Backend (`StateStorage<TRaw = string>`)** — anything with `getItem`/`setItem`/`removeItem`, sync or Promise-returning, string-wire by default, generic for structured backends.

```ts
import { createSerovalStorage } from "@stainless-code/persist/codecs/seroval";
import { createIdbStorage } from "@stainless-code/persist/backends/idb";
import { createJSONStorage } from "@stainless-code/persist";

createSerovalStorage(() => localStorage); // durable prefs
createSerovalStorage(() => sessionStorage); // per-visit state (dies with the tab)
createIdbStorage(); // IndexedDB, structured-clone mode
createJSONStorage(() => AsyncStorage); // React Native — or use ./backends/async-storage for the typed adapter
createAsyncStorage(); // React Native AsyncStorage — async, useHydrated gating
createMmkvStorage({ id: "app-prefs" }); // React Native MMKV — sync, no gate needed
createSecureStoreStorage(); // expo-secure-store — OS keychain, ~2KB/key, for secrets
// custom: in-memory for tests, remote KV, encrypted wrapper — implement 3 methods
```

**2. Codec (`StorageCodec<S, TRaw = string>`)** — pure `encode`/`decode` between the persisted envelope and the backend's wire type.

```ts
import {
  jsonCodec,
  identityCodec,
  createStorage,
} from "@stainless-code/persist";
import { serovalCodec } from "@stainless-code/persist/codecs/seroval";
import { zodCodec } from "@stainless-code/persist/codecs/zod";
import { idbStateStorage } from "@stainless-code/persist/backends/idb";
import { z } from "zod";

const PrefsSchema = z.object({ theme: z.enum(["light", "dark"]) });

jsonCodec(); // core default — plain JSON
serovalCodec(); // Set / Map / Date / cycles, inert JSON-shaped output
zodCodec(PrefsSchema); // schema-gated persistence — invalid state never writes; corrupt reads discard
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
} from "@stainless-code/persist/sources/tanstack-store";
import { persistSource } from "@stainless-code/persist";

persistStore(store, opts); // @tanstack/store Store
persistAtom(atom, opts); // writable Atom (replace-merge default)
persistSource({ getState, setState, subscribe }, opts); // zustand-like, redux, hand-rolled
```

Compose freely: `createStorage(backend, codec, options)` covers every backend × codec cell. **Factory policy:** codec factories take the backend as an argument; a backend earns its own factory only when it needs real adaptation (IndexedDB); everything else composes — no factory-per-combination.

## Recipes

```ts
import { createStorage } from "@stainless-code/persist";
import {
  idbStateStorage,
  createIdbStorage,
} from "@stainless-code/persist/backends/idb";
import { serovalCodec } from "@stainless-code/persist/codecs/seroval";
import { persistStore } from "@stainless-code/persist/sources/tanstack-store";

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

### Clear-all on logout

```ts
import { createPersistRegistry } from "@stainless-code/persist";
import { createSerovalStorage } from "@stainless-code/persist/codecs/seroval";
import { persistStore } from "@stainless-code/persist/sources/tanstack-store";

// One registry for every persisted store — clearAll() at logout wipes all keys
// (allSettled; first rejection rethrows; destroy() unregisters each store)
const registry = createPersistRegistry();
const storage = createSerovalStorage(() => localStorage);

persistStore(prefsStore, { name: "app:prefs", storage, registry });
persistStore(cartStore, { name: "app:cart", storage, registry });
persistStore(sessionStore, { name: "app:session", storage, registry });

async function logout() {
  await registry.clearAll();
}
```

### Partialize

```ts
// Persist only prefs — ephemeral fields (scroll, modal) changing alone never write
persistStore(store, {
  name: "app:state",
  storage,
  partialize: (state) => state.prefs,
});
```

### Merge

```ts
// Deep-merge nested settings on hydrate — default is shallow spread (persisted over current)
persistStore(store, {
  name: "app:settings",
  storage,
  merge: (persisted, current) => ({
    ...current,
    settings: {
      ...current.settings,
      ...(persisted as typeof current).settings,
    },
  }),
});
```

### retryWrite — shrink-or-give-up on quota

```ts
// Quota exceeded: shrink state to retry, return undefined to give up.
// errorCount is the aggressiveness dial; stale retries never clobber newer state.
persistStore(store, {
  name: "app:history",
  storage,
  retryWrite: ({ state, errorCount }) => {
    if (errorCount === 1)
      return { ...state, history: state.history.slice(-50) };
    if (errorCount === 2) return { ...state, history: [] };
    return; // give up — last error goes to onError
  },
});
```

### throttleMs — trailing throttle

```ts
// Coalesce a write burst into one trailing write with flush-time state; destroy() flushes pending
persistStore(store, {
  name: "app:canvas",
  storage,
  throttleMs: 250,
});
```

### maxAge — payload expiry

```ts
// Discard payloads older than 7 days (by timestamp); missing timestamp = expired; key removed before migrate runs
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

persistStore(store, {
  name: "app:draft",
  storage,
  maxAge: SEVEN_DAYS,
});
```

### buster — cache-busting

```ts
// Format changed completely — bust stale keys instead of migrating wrong values (checked before migrate)
persistStore(store, {
  name: "app:layout",
  storage,
  buster: "grid-v2",
});
```

### Cross-tab over IndexedDB

```ts
import { createBroadcastCrossTab } from "@stainless-code/persist/transport/crosstab";
import { createIdbStorage } from "@stainless-code/persist/backends/idb";

// IDB fires no storage events — bridge a BroadcastChannel as the transport.
// storageArea: null in every posted event → key-only matching in every tab.
const bridge = createBroadcastCrossTab({ channelName: "app:prefs" })!;
persistStore(store, {
  name: "app:prefs:v1",
  storage: bridge.wrap(createIdbStorage()!),
  crossTab: true,
  crossTabEventTarget: bridge.crossTabEventTarget,
});
// teardown: persist.destroy(); bridge.close();
```

Caveats that matter per backend: async backends (IDB) can't settle hydration before first paint → gate UI on `useHydrated` (`@stainless-code/persist/frameworks/react`); `sessionStorage` is per-tab (crossTab is meaningless); `identityCodec` never with string-only backends.

## Writing a framework adapter

The React hook (`@stainless-code/persist/frameworks/react`) is ~20 lines over `HydrationSignal` — every adapter is the same shape. Solid (`@stainless-code/persist/frameworks/solid`, `Accessor<boolean>` via `from`), Vue (`@stainless-code/persist/frameworks/vue`, `Ref<boolean>` via `shallowRef` + `onScopeDispose`), and Svelte (`@stainless-code/persist/frameworks/svelte` runes `hydratedRune`; `@stainless-code/persist/frameworks/svelte-store` `hydratedStore` for Svelte 4 + Svelte 5 store users) ship the same way. The contract (full version on `HydrationSignal`'s JSDoc): subscribe returns an idempotent unsubscribe; each subscribe call is an independent subscription; **no initial notification and no payload** — pull `isHydrated()` after attach and on every notification; transitions while detached aren't replayed (the snapshot re-read recovers); **render `hydrated: true` on the server** (no storage server-side); `null` signal = no persistence = hydrated.

```ts
import type { HydrationSignal } from "@stainless-code/persist";

// The shipped `./frameworks/svelte` adapter, in full — every adapter is this shape:
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

## API reference

Full type-level reference is generated by TypeDoc — not hosted yet; build locally: `bun run docs:api`, then open `docs/api/index.html`. The authoritative contract for each entry is its JSDoc (hover in your editor).
