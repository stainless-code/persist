// Library core — ZERO value imports by design (enforced by a test). Adapters
// under `./codecs|backends|transport|sources|frameworks/` each map 1:1 to a
// package entry point; consumers import them directly — no barrel, so every
// dependency edge is the import graph.

/**
 * Minimal string-keyed storage interface (matches `localStorage` /
 * `sessionStorage` at the default `TRaw = string`). Generic over the wire
 * type so structured-clone backends (IndexedDB) can carry objects without a
 * string round-trip — mirrors TanStack Query's
 * `AsyncStorage<TStorageValue = string>`. `TRaw` must not be a thenable: the
 * sync-vs-Promise branch on `getItem` couldn't tell a raw value apart from a
 * pending read. Async detection uses `instanceof Promise` (native, same
 * realm) rather than thenable duck-typing — deliberately, so a stored value
 * whose state happens to carry a `then` property is never mistaken for a
 * pending read; async backends must return native same-realm promises.
 */
export interface StateStorage<TRaw = string> {
  getItem: (name: string) => TRaw | null | Promise<TRaw | null>;
  setItem: (name: string, value: TRaw) => void | Promise<void>;
  removeItem: (name: string) => void | Promise<void>;
}

/** Wrapper persisted under each key: the state plus its schema version. */
export interface StorageValue<S> {
  state: S;
  version?: number;
  /**
   * Write time, stamped on every write. Basis for `maxAge` expiry on hydrate;
   * a payload without one (e.g. written by a different persist
   * implementation) counts as expired when `maxAge` is configured.
   */
  timestamp?: number;
  /**
   * Cache-buster stamp, written only when the `buster` option is configured.
   * A mismatch discards the payload on hydrate.
   */
  buster?: string;
}

/**
 * Keyed store of `StorageValue`s — the encoded storage layer `persistSource`
 * reads and writes. Build one with `createStorage` (backend × codec), use a
 * shipped factory (`createJSONStorage` / `createSerovalStorage`), or
 * hand-roll the three methods for exotic backends.
 */
export interface PersistStorage<S> {
  getItem: (
    name: string,
  ) => StorageValue<S> | null | Promise<StorageValue<S> | null>;
  setItem: (name: string, value: StorageValue<S>) => void | Promise<void>;
  removeItem: (name: string) => void | Promise<void>;
  /**
   * The raw backing storage object (set by `createStorage`). Cross-tab
   * rehydrate identity-compares `event.storageArea` against it; when absent
   * (hand-rolled implementations), cross-tab falls back to key-only matching.
   * Typed `unknown` deliberately — only identity matters, and typing it
   * `StateStorage<TRaw>` would cascade the wire-type generic into
   * `PersistOptions`/`PersistApi` for no benefit.
   */
  raw?: unknown;
}

/**
 * Pure (de)serialization of a `StorageValue` to/from the backend's wire type
 * (`TRaw`, default `string`) — the codec half of the two-axis split (backend
 * `StateStorage` × codec). A custom codec (superjson / devalue / compression
 * / encryption) plugs into {@link createStorage} here instead of
 * reimplementing the full `PersistStorage` plumbing. For structured-clone
 * backends, {@link identityCodec} skips (de)serialization entirely.
 */
export interface StorageCodec<S, TRaw = string> {
  encode: (value: StorageValue<S>) => TRaw;
  decode: (raw: TRaw) => StorageValue<S>;
}

/** Standard `JSON.parse` reviver / `JSON.stringify` replacer pass-throughs. */
export interface JsonStorageOptions {
  reviver?: (key: string, value: unknown) => unknown;
  replacer?: (key: string, value: unknown) => unknown;
}

export interface CreateStorageOptions {
  /**
   * Remove the storage key when `codec.decode` throws (corrupt-payload
   * self-heal). When off, a corrupt payload hydrates to nothing and stays in
   * storage.
   * @default false
   */
  clearCorruptOnFailure?: boolean;
}

/**
 * Minimal shape of a browser `storage` event — structural so a non-DOM
 * `crossTabEventTarget` (tests, custom runtimes like a `BroadcastChannel`
 * bridge) can dispatch fakes without the DOM `StorageEvent` global. The real
 * browser `StorageEvent` satisfies this shape.
 */
export interface CrossTabStorageEvent {
  key: string | null;
  newValue: string | null;
  storageArea: unknown;
}

/**
 * Event-target seam for cross-tab sync. Defaults to `window` when
 * `crossTab: true` and one exists; inject a fake to drive simulated
 * `storage` events in non-DOM environments (tests), or a custom bridge
 * (e.g. `BroadcastChannel`) as an alternate transport.
 */
export interface CrossTabEventTarget {
  addEventListener: (
    type: "storage",
    listener: (event: CrossTabStorageEvent) => void,
  ) => void;
  removeEventListener: (
    type: "storage",
    listener: (event: CrossTabStorageEvent) => void,
  ) => void;
}

export interface PersistOptions<TState, TPersistedState = TState> {
  /** Storage key. Must be unique per persisted store. */
  name: string;
  /**
   * Storage layer to read/write. When no backend is available at all (SSR,
   * tests), `persistSource` returns a no-op `PersistApi`. For `Set`/`Map`/
   * `Date` round-trips pass `createSerovalStorage` (from `./codecs/seroval`).
   * @default JSON-encoded `localStorage` (`createJSONStorage`)
   */
  storage?: PersistStorage<TPersistedState>;
  /**
   * Project `TState` to the slice that should be persisted.
   * @default identity — the full state is persisted
   */
  partialize?: (state: TState) => TPersistedState;
  /**
   * Called at the start of every (re)hydrate with the pre-hydration state.
   * Optionally returns a callback invoked when that hydrate settles —
   * `(state, undefined)` on success, `(undefined, error)` on failure.
   */
  onRehydrateStorage?: (
    state: TState,
  ) => ((state?: TState, error?: unknown) => void) | void;
  /**
   * Schema version stamped on every write. A stored payload with a different
   * version goes through {@link migrate} on hydrate.
   * @default 0
   */
  version?: number;
  /**
   * Transform persisted state from an older version to the current one.
   * Without it, a version mismatch discards the payload (reported to
   * `onError`, phase `"migrate"`). For "old values are simply wrong, don't
   * migrate them" see {@link buster}.
   * @param persistedState The stored payload's state, as read from storage.
   * @param version The STORED payload's version (not the configured one).
   */
  migrate?: (
    persistedState: unknown,
    version: number,
  ) => TPersistedState | Promise<TPersistedState>;
  /**
   * Combine persisted state with current state on hydrate.
   * @default shallow spread of persisted over current (`persistAtom` replaces
   * instead — a spread would corrupt primitive atom values)
   */
  merge?: (persistedState: unknown, currentState: TState) => TState;
  /**
   * Skip the initial hydrate read (caller invokes `rehydrate()` manually).
   * @default false
   */
  skipHydration?: boolean;
  /**
   * When true, remove the storage key instead of writing (e.g. the slice equals
   * the default). Evaluated against the **partialized** slice, not the full
   * state — so a non-persisted field changing alone never writes a key whose
   * persisted slice still equals the default. When combined with
   * {@link crossTab}, also wire {@link onCrossTabRemove}.
   * @default undefined (never skip — every eligible write persists)
   */
  skipPersist?: (state: TPersistedState) => boolean;
  /**
   * Storage/migrate error sink. When provided, write/hydrate/migrate errors are
   * routed here instead of `console.*`. The `console.error` / `console.warn`
   * fallback is dev-only (`process.env.NODE_ENV !== "production"`, a
   * bundler-replaceable check so prod tree-shakes it): prod without a sink is
   * silent by design — wire `onError` for production observability. Errors
   * never propagate into the caller's `setState` regardless.
   */
  onError?: (
    error: unknown,
    context: {
      name: string;
      phase: "write" | "hydrate" | "migrate" | "crossTab";
    },
  ) => void;
  /**
   * Optional clear-callback registry. When provided, the store's
   * `clearStorage` is registered there (and unregistered on `destroy()`) so
   * one `registry.clearAll()` — e.g. at logout — wipes every persisted key.
   * When omitted, the store never registers; there is no ambient registry.
   */
  registry?: PersistRegistry;
  /**
   * Opt-in cross-tab sync. When `true`, listens for `storage` events on
   * `crossTabEventTarget` (defaulting to `window`) and calls `rehydrate()`
   * when one matches this store's key + storage area — a change in tab A
   * rehydrates tab B.
   *
   * No echo loops: the browser never fires `storage` in the originating tab,
   * and overlapping rehydrates dedupe via the internal race guard. The
   * listener attaches regardless of `skipHydration`, is removed by
   * `destroy()`, and silently no-ops without a `window`. Key-removal events
   * are owned by {@link onCrossTabRemove} — wire it whenever
   * {@link skipPersist} is also configured.
   * @default false
   */
  crossTab?: boolean;
  /**
   * Override the `storage`-event source for `crossTab`. Inject a fake in
   * tests / non-DOM runtimes, or a custom bridge (e.g. `BroadcastChannel`)
   * when `storage` events aren't the right transport.
   * @default `window`, when one exists
   */
  crossTabEventTarget?: CrossTabEventTarget;
  /**
   * Removal semantics for `crossTab`: invoked when another tab REMOVES this
   * store's key (`storage` event with `newValue: null` — e.g. that tab's
   * `skipPersist` reset-to-default). A removal can't be expressed through
   * `rehydrate()` — "no stored state" keeps the current state, correct for
   * initial hydrate but stale here — so reset to your initial state in this
   * callback. Without it, removal events fall back to `rehydrate()` and the
   * local tab keeps its state (tabs diverge on reset-to-default). Pair with
   * {@link skipPersist} whenever {@link crossTab} is on. Throws are contained
   * and reported to `onError` (phase `"crossTab"`).
   */
  onCrossTabRemove?: () => void;
  /**
   * Max age in ms. On hydrate, a payload older than this (by its `timestamp`
   * stamp — a payload without one counts as expired) is treated as absent
   * and the key removed, so the store keeps its current/initial state.
   * Expiry runs BEFORE version/migrate — expired data is never migrated.
   * @default undefined (no expiry)
   */
  maxAge?: number;
  /**
   * Cache-buster string, stamped on every write when configured. On hydrate,
   * a stored payload whose `buster` differs is discarded and the key removed
   * — same treatment as {@link maxAge} expiry. Prefer `buster` over
   * `version` + {@link migrate} when semantics changed so completely that old
   * values are wrong and migrating them is pointless.
   * @default undefined (no busting)
   */
  buster?: string;
  /**
   * Trailing throttle window (ms) for subscribe-writes. The first eligible
   * `setState` after a flush schedules a timer; further calls within the
   * window coalesce; when the timer fires, ONE write happens with the state
   * read at flush time (last write wins). Trailing-only — the first call
   * waits out the window instead of writing immediately (TanStack Query's
   * persister throttle is leading+trailing; ours trades first-write latency
   * for a simpler single-timer model). Not throttled: {@link skipPersist}
   * removals (a reset-to-default must drop the key immediately — a pending
   * write is cancelled, the removal supersedes it) and the one-shot
   * post-migrate write-back. `destroy()` flushes a pending write immediately
   * (initiated at teardown; an async backend's `setItem` is fired, not
   * awaited) so no coalesced state is silently dropped.
   * @default undefined (no throttling — every setState writes)
   */
  throttleMs?: number;
  /**
   * Shrink-or-give-up write retry. When a `setItem` throws (sync quota) or
   * rejects (async backend), the callback receives the slice that failed,
   * the error, and `errorCount` (1 on the first invocation, incrementing per
   * retry). Return a smaller state to re-attempt — the storage envelope is
   * rebuilt fresh per attempt (new `timestamp`, current `version`/`buster`)
   * — or `undefined` to give up, which reports the LAST error to `onError`
   * (phase `"write"`) exactly once. This callback IS the termination policy:
   * the loop is uncapped, so a callback that always returns a state spins
   * forever. Applies to both `setItem` paths (subscribe-writes and the
   * post-migrate write-back); `removeItem` paths are excluded and
   * {@link skipPersist} is NOT re-evaluated on retry states. A newer
   * `setState` write or `destroy()` silently abandons an in-flight retry
   * loop — a stale shrunk state never clobbers fresher state. Without the
   * option, the first write error is reported and no retry happens.
   *
   * @example
   * ```ts
   * // Drop the heaviest field progressively; errorCount is the
   * // aggressiveness dial. Terminate with `undefined`.
   * retryWrite: ({ state, errorCount }) => {
   *   if (errorCount === 1) return { ...state, history: state.history.slice(-20) };
   *   if (errorCount === 2) return { ...state, history: [] };
   *   return; // give up — last error goes to onError
   * },
   * ```
   * @default undefined (no retry — first write error is reported)
   */
  retryWrite?: (context: {
    /** The slice that just failed to write. */
    state: TPersistedState;
    error: unknown;
    /** 1 on the first invocation, incrementing per retry. */
    errorCount: number;
  }) => TPersistedState | undefined | Promise<TPersistedState | undefined>;
}

type PersistListener<S> = (state: S) => void;

/** Lifecycle handle returned by `persistSource` / `persistStore` / `persistAtom`. */
export interface PersistApi<TState, TPersistedState = TState> {
  /**
   * Merge new options (explicit `undefined` entries are ignored). Structural
   * options wired at create time — `registry`, `crossTab`,
   * `crossTabEventTarget` — are NOT re-wired here: passing them after creation
   * updates `getOptions()` but attaches no listener / registration.
   */
  setOptions: (
    options: Partial<PersistOptions<TState, TPersistedState>>,
  ) => void;
  /** Remove this store's key from storage (state stays in memory). */
  clearStorage: () => void | Promise<void>;
  /**
   * Re-run hydration from storage. Awaitable — resolves after the merge
   * landed and finish-hydration listeners ran. Overlapping calls race-guard:
   * the latest call wins, stale ones resolve without effect.
   */
  rehydrate: () => Promise<void> | void;
  /** `false` while a (re)hydrate is in flight; subscribe-writes are gated on it. */
  hasHydrated: () => boolean;
  /** Listen for hydration START (per (re)hydrate). Returns an unsubscribe fn. */
  onHydrate: (fn: (state: TState) => void) => () => void;
  /** Listen for hydration END — success or failure. Returns an unsubscribe fn. */
  onFinishHydration: (fn: (state: TState) => void) => () => void;
  getOptions: () => PersistOptions<TState, TPersistedState>;
  /**
   * Full teardown: detach the source subscription, remove the cross-tab
   * listener, unregister from the clear registry, FLUSH any pending
   * throttled write (one immediate attempt, initiated at teardown — an async
   * backend's `setItem` is fired, not awaited; see
   * {@link PersistOptions.throttleMs}), and cancel any in-flight hydrate and
   * {@link PersistOptions.retryWrite} loop. Required for non-singleton
   * persisted stores (created per mount/scope) to avoid leaks; module
   * singletons never need it.
   */
  destroy: () => void;
}

/**
 * Minimal reactive source `persistSource` can attach to. `Store` and writable
 * `Atom` from `@tanstack/store` satisfy this via the `persistStore` /
 * `persistAtom` adapters; pass a custom implementation to persist anything else.
 */
export interface PersistableSource<TState> {
  getState: () => TState;
  setState: (updater: (prev: TState) => TState) => void;
  subscribe: (listener: () => void) => { unsubscribe: () => void };
}

/**
 * Clear-callback registry for persisted stores. The core has no ambient
 * module state and never auto-registers: a store joins a registry only via
 * its `registry` option. The application owns the instance and decides when
 * `clearAll()` runs (typically session end / logout).
 */
export interface PersistRegistry {
  /** Register a clear callback; returns an unregister fn. */
  register: (clearStorage: () => void | Promise<void>) => () => void;
  /**
   * Wipe every registered store's key. Each registered clear is attempted
   * even if one throws — the first rejection is re-thrown after all run.
   */
  clearAll: () => Promise<void>;
}

/**
 * Build a `PersistRegistry`. `clearAll` uses `allSettled` +
 * rethrow-first-rejection semantics: one throwing backend can't skip the
 * remaining clears, and the caller still sees the first failure.
 */
export function createPersistRegistry(): PersistRegistry {
  const clears = new Set<() => void | Promise<void>>();
  return {
    register(clearStorage) {
      clears.add(clearStorage);
      return () => clears.delete(clearStorage);
    },
    async clearAll() {
      const results = await Promise.allSettled(
        [...clears].map((clear) => Promise.resolve().then(clear)),
      );
      const rejected = results.find(
        (r): r is PromiseRejectedResult => r.status === "rejected",
      );
      if (rejected) throw rejected.reason;
    },
  };
}

/**
 * Options for {@link createMigrationChain}.
 */
export interface CreateMigrationChainOptions<S> {
  /** Current schema version — must equal {@link PersistOptions.version}. */
  version: number;
  /**
   * Per-version migration steps, keyed by the version each step transforms
   * *from*: `steps[N]` takes vN state → v(N+1). The covered range
   * `[minKey, version-1]` must be gap-free (validated eagerly at
   * construction); `minKey > 0` drops support for older versions. Each
   * step may be sync or Promise.
   */
  steps: Record<number, (state: S) => S | Promise<S>>;
  /**
   * Stored payload's version is *newer* than {@link version} (a downgrade).
   * `"throw"` (default) → the returned `migrate` throws → persist-core
   * routes it to `onError` phase `"migrate"`. `"discard"` → `migrate`
   * resolves `undefined` → hydrate keeps the current/initial state and
   * writes it back, replacing the stored payload.
   */
  onNewer?: "discard" | "throw";
  /**
   * Stored payload's version is older than the chain's earliest step
   * (`minKey > 0` — you dropped support for that version). `"discard"`
   * (default) → hydrate keeps the current/initial state and writes it
   * back, replacing the stored payload. `"throw"` → `onError` phase
   * `"migrate"`.
   */
  onOlder?: "discard" | "throw";
}

/**
 * Build a `migrate` callback from a per-version step chain. The returned
 * function walks `steps[fromVersion]` → `steps[fromVersion+1]` → … →
 * `steps[version-1]`, awaiting each, so a payload at any supported older
 * version migrates to the current one. Plug it straight into
 * {@link PersistOptions.migrate}.
 *
 * Beyond TanStack Persist's `buster` (which discards on mismatch) — this
 * transforms instead. The chain is validated eagerly at construction: a
 * gap in the covered range, an out-of-range key, or a non-integer version
 * throws now, not on a payload months later.
 *
 * @example
 * ```ts
 * import { createMigrationChain } from "@stainless-code/persist";
 * import { persistStore } from "@stainless-code/persist/sources/tanstack-store";
 *
 * const migrate = createMigrationChain<Prefs>({
 *   version: 3,
 *   steps: {
 *     0: (s) => ({ ...s, theme: "light" }),
 *     1: (s) => ({ ...s, filters: [] }),
 *     2: (s) => ({ ...s, layout: "grid" }),
 *   },
 * });
 * persistStore(store, { name: "app:prefs:v3", version: 3, migrate });
 * ```
 */
export function createMigrationChain<S>(
  options: CreateMigrationChainOptions<S>,
): (state: unknown, fromVersion: number) => Promise<S> {
  const { version, steps, onNewer = "throw", onOlder = "discard" } = options;

  if (!Number.isInteger(version) || version < 0) {
    throw new Error(
      `[createMigrationChain] version must be a non-negative integer, got ${version}`,
    );
  }

  const fromKeys: number[] = [];
  for (const key of Object.keys(steps)) {
    const from = Number(key);
    if (!Number.isInteger(from) || from < 0 || from >= version) {
      throw new Error(
        `[createMigrationChain] step key must be a non-negative integer in [0, ${version - 1}], got "${key}"`,
      );
    }
    fromKeys.push(from);
  }
  fromKeys.sort((a, b) => a - b);
  // The covered range is [minKey, version-1]; no gaps within it.
  const minKey = fromKeys.length ? fromKeys[0] : 0;
  for (let from = minKey; from < version; from++) {
    if (typeof steps[from] !== "function") {
      throw new Error(
        `[createMigrationChain] missing migration step from v${from} (gap in [${minKey}, ${version - 1}])`,
      );
    }
  }

  return async (state, fromVersion) => {
    if (!Number.isInteger(fromVersion)) {
      throw new Error(
        `[createMigrationChain] stored version must be an integer, got ${fromVersion}`,
      );
    }
    if (fromVersion > version) {
      if (onNewer === "throw") {
        throw new Error(
          `[createMigrationChain] stored version ${fromVersion} is newer than current ${version} (downgrade not supported)`,
        );
      }
      return undefined as unknown as S;
    }
    if (fromVersion < minKey) {
      if (onOlder === "throw") {
        throw new Error(
          `[createMigrationChain] stored version ${fromVersion} is older than the chain's earliest supported v${minKey}`,
        );
      }
      return undefined as unknown as S;
    }
    let current = state as S;
    for (let from = fromVersion; from < version; from++) {
      current = await steps[from](current);
    }
    return current;
  };
}

/**
 * JSON codec — no `Set` / `Map` / `Date` round-trip. Accepts the standard
 * `JSON.parse` reviver / `JSON.stringify` replacer.
 */
export const jsonCodec = <S>(
  options?: JsonStorageOptions,
): StorageCodec<S> => ({
  encode: (value) => JSON.stringify(value, options?.replacer),
  decode: (raw) => JSON.parse(raw, options?.reviver) as StorageValue<S>,
});

/**
 * Identity codec for structured-clone backends (`TRaw = StorageValue<S>`):
 * the backend stores the envelope natively — IndexedDB's structured-clone
 * algorithm round-trips `Set` / `Map` / `Date` without any serialization, so
 * string codecs (JSON / seroval) become pure overhead there. Never use with
 * string-only backends (`localStorage`).
 */
export const identityCodec = <S>(): StorageCodec<S, StorageValue<S>> => ({
  encode: (value) => value,
  decode: (raw) => raw,
});

/**
 * The one shared `PersistStorage` plumbing: getStorage try-guard (returns
 * `undefined` when the backend is unavailable), sync-vs-Promise branching on
 * `getItem`, and unified corrupt-payload handling (decode throw → `null` +
 * optional key removal via `clearCorruptOnFailure`). Pass any
 * {@link StorageCodec} to swap the serialization format without
 * reimplementing this layer.
 *
 * @example
 * ```ts
 * // custom codec (superjson, devalue, compression, encryption, …)
 * const storage = createStorage<Prefs>(
 *   () => localStorage,
 *   { encode: superjson.stringify, decode: superjson.parse },
 *   { clearCorruptOnFailure: true },
 * );
 * ```
 */
export function createStorage<S, TRaw = string>(
  getStorage: () => StateStorage<TRaw>,
  codec: StorageCodec<S, TRaw>,
  options?: CreateStorageOptions,
): PersistStorage<S> | undefined {
  let storage: StateStorage<TRaw>;
  try {
    storage = getStorage();
  } catch {
    return;
  }

  // Node 22+ exposes a `localStorage` global whose methods are `undefined`
  // without a valid `--localstorage-file` path. The lookup doesn't throw — the
  // global exists as an object — so without this shape check the broken
  // backend passes availability and crashes in `hydrate` at `storage.getItem`.
  if (
    typeof storage?.getItem !== "function" ||
    typeof storage?.setItem !== "function" ||
    typeof storage?.removeItem !== "function"
  ) {
    return;
  }

  const parseStored = (
    name: string,
    raw: TRaw | null,
  ): StorageValue<S> | null => {
    if (raw === null) return null;
    try {
      return codec.decode(raw);
    } catch {
      if (options?.clearCorruptOnFailure) {
        // Best-effort cleanup; an async backend's rejected removeItem must not
        // become an unhandled rejection outside every containment path.
        try {
          const removal = storage.removeItem(name);
          if (removal instanceof Promise) removal.catch(() => {});
        } catch {
          // sync removeItem throw — corrupt payload already neutralized by
          // returning null; nothing more to clean up
        }
      }
      return null;
    }
  };

  return {
    getItem(name) {
      const raw = storage.getItem(name) ?? null;
      if (raw instanceof Promise) {
        return raw.then((value) => parseStored(name, value ?? null));
      }
      return parseStored(name, raw);
    },
    setItem(name, value) {
      return storage.setItem(name, codec.encode(value)) as void | Promise<void>;
    },
    removeItem(name) {
      return storage.removeItem(name) as void | Promise<void>;
    },
    // Expose the raw backend so cross-tab rehydrate can compare
    // `event.storageArea` against the actual `Storage` object (TanStack DB
    // reference guard). Custom `PersistStorage` impls without this field fall
    // back to key-only matching.
    raw: storage,
  };
}

/**
 * Build a JSON-encoded `PersistStorage` (no `Set`/`Map`/`Date` round-trip).
 * The backend is the argument — `() => localStorage`, `() => sessionStorage`,
 * or any custom `StateStorage`. For corrupt-payload self-heal
 * (`clearCorruptOnFailure`), use
 * `createStorage(getStorage, jsonCodec(options), { clearCorruptOnFailure })`
 * directly — this factory's options are codec-only (reviver/replacer).
 */
export function createJSONStorage<S>(
  getStorage: () => StateStorage,
  options?: JsonStorageOptions,
): PersistStorage<S> | undefined {
  return createStorage(getStorage, jsonCodec<S>(options));
}

/**
 * Build a JSON-encoded `PersistStorage` over `sessionStorage` — per-tab, so
 * `crossTab` is meaningless.
 */
export function createSessionStorage<S>(
  options?: JsonStorageOptions,
): PersistStorage<S> | undefined {
  if (typeof sessionStorage === "undefined") return;
  return createJSONStorage<S>(() => sessionStorage, options);
}

/**
 * Default merge: shallow-spread persisted over current. Single definition
 * referenced by both the options initializer and the hydrate fallback.
 */
const shallowSpreadMerge = <TState>(
  persistedState: unknown,
  currentState: TState,
): TState => ({
  ...currentState,
  ...(persistedState as Partial<TState>),
});

/**
 * Spread `patch` into `base` skipping explicit `undefined` values, so a caller
 * passing `{ merge: undefined }` to `setOptions` can't clobber an existing
 * (or default) value — only real values win.
 */
function mergeDefined<T extends object>(base: T, patch: Partial<T>): T {
  const result = { ...base } as T;
  for (const key of Object.keys(patch) as Array<keyof T & string>) {
    if (patch[key] !== undefined) {
      result[key] = patch[key] as T[keyof T & string];
    }
  }
  return result;
}

function createNoopApi<TState, TPersistedState>(
  options: PersistOptions<TState, TPersistedState>,
): PersistApi<TState, TPersistedState> {
  return {
    setOptions() {},
    clearStorage() {},
    rehydrate() {},
    hasHydrated: () => true,
    onHydrate: () => () => {},
    onFinishHydration: () => () => {},
    getOptions: () => options,
    destroy() {},
  };
}

function resolveDefaultStorage<TState, TPersistedState>(
  options: PersistOptions<TState, TPersistedState>,
): PersistStorage<TPersistedState> | undefined {
  if (options.storage) return options.storage;
  if (typeof localStorage === "undefined") return;
  // JSON default keeps the core zero-dep — a seroval default would drag a
  // runtime dependency into every consumer. `Set`/`Map`/`Date` users opt in
  // by passing `createSerovalStorage` from `./codecs/seroval` explicitly.
  return createJSONStorage<TPersistedState>(() => localStorage);
}

/**
 * Attach persist to any `PersistableSource`: hydrate from storage on create,
 * subscribe-write on every `setState`. Returns the lifecycle `PersistApi`.
 * No-op `PersistApi` (always hydrated) when storage is unavailable (SSR / tests).
 */
export function persistSource<TState, TPersistedState = TState>(
  source: PersistableSource<TState>,
  baseOptions: PersistOptions<TState, TPersistedState>,
): PersistApi<TState, TPersistedState> {
  // `mergeDefined` (not a plain spread) so an explicit `merge: undefined` in
  // caller options can't clobber a default at create time — same guard
  // `setOptions` applies (matters most for `persistAtom`, whose replace-merge
  // default protects primitive states from being spread into `{}`).
  let options: PersistOptions<TState, TPersistedState> = mergeDefined(
    {
      version: 0,
      merge: shallowSpreadMerge,
    } as PersistOptions<TState, TPersistedState>,
    baseOptions,
  );

  let storage = resolveDefaultStorage(options);

  // Error sink — full contract on the `onError` option JSDoc (dev-only
  // console fallback, silent prod by design). Errors never reach the
  // caller's `setState` either way.
  const reportError = (
    error: unknown,
    phase: "write" | "hydrate" | "migrate" | "crossTab",
  ) => {
    if (options.onError) {
      options.onError(error, { name: options.name, phase });
    } else if (process.env.NODE_ENV !== "production") {
      console.error(
        `[persistStore] ${phase} error for '${options.name}':`,
        error,
      );
    }
  };

  if (!storage) {
    const message = `[persistStore] Unable to persist '${options.name}' — storage unavailable.`;
    if (options.onError) {
      options.onError(new Error(message), {
        name: options.name,
        phase: "hydrate",
      });
    } else if (process.env.NODE_ENV !== "production") {
      console.warn(message);
    }
    return createNoopApi(options);
  }

  let hasHydratedFlag = false;
  let hydrationVersion = 0;
  // True while persist-core is driving `source.setState` itself (the hydrate
  // merge) so the subscribe gate can distinguish that notification from a user
  // `setState` during the hydrate window (see `writeSkippedDuringHydrate`).
  let internalSetState = false;
  // A user `setState` landed during an async hydrate — the subscribe gate drops
  // it (a stale flush would race the storage read). Re-scheduled after settle so
  // the change isn't silently lost on reload with no follow-up write.
  let writeSkippedDuringHydrate = false;
  const hydrationListeners = new Set<PersistListener<TState>>();
  const finishHydrationListeners = new Set<PersistListener<TState>>();

  // The partialized slice for the CURRENT source state — shared by
  // `writeToStorage` and the throttle's immediate-removal check.
  const getPersistedSlice = (): TPersistedState => {
    const partialize =
      options.partialize ?? ((s: TState) => s as unknown as TPersistedState);
    return partialize(source.getState());
  };

  // Write-generation counter (sibling of `hydrationVersion`): every top-level
  // write event — setItem, skipPersist removal — starts a new generation, and
  // `destroy()` bumps it too. An in-flight `retryWrite` loop captured an older
  // generation and abandons SILENTLY on mismatch: a stale shrunk state must
  // never clobber fresher state (or resurrect a removed key).
  let writeGeneration = 0;

  // Envelope built fresh per attempt (retry included): always stamp
  // `timestamp` (cheap, backward compatible) so `maxAge` expiry has a basis;
  // `buster` only when configured — both read at attempt time.
  const buildEnvelope = (
    state: TPersistedState,
  ): StorageValue<TPersistedState> => ({
    state,
    version: options.version,
    timestamp: Date.now(),
    ...(options.buster !== undefined ? { buster: options.buster } : {}),
  });

  const attemptWrite = (state: TPersistedState) =>
    storage!.setItem(options.name, buildEnvelope(state));

  // The `retryWrite` loop, entered only after a first failure with the
  // option configured (contract on the `retryWrite` option JSDoc). Generation
  // checks before every callback invocation and before committing its result
  // keep a superseded loop from writing.
  const retryLoop = async (
    state: TPersistedState,
    firstError: unknown,
    generation: number,
  ): Promise<void> => {
    let current = state;
    let error = firstError;
    let errorCount = 0;
    while (true) {
      if (generation !== writeGeneration) return; // superseded — abandon silently
      // Read at loop time so setOptions can swap it; gone mid-loop = give up.
      const retryWrite = options.retryWrite;
      if (!retryWrite) {
        reportError(error, "write");
        return;
      }
      errorCount++;
      const next = await retryWrite({ state: current, error, errorCount });
      // Re-check after the (possibly async) callback: a newer write may have
      // landed while the shrunk state was computed — committing it would
      // clobber that fresher state.
      if (generation !== writeGeneration) return;
      if (next === undefined) {
        reportError(error, "write"); // give up: LAST error, exactly once
        return;
      }
      current = next;
      try {
        await attemptWrite(current);
        return; // success — report nothing
      } catch (nextError) {
        error = nextError;
      }
    }
  };

  // One guarded setItem shared by BOTH write paths (subscribe-write and the
  // post-migrate write-back). Sync fast path: when the first attempt succeeds
  // on a sync backend — or fails with no `retryWrite` (rethrow into
  // writeSafe's plain try/catch) — no promise is allocated; only a failure
  // with `retryWrite` configured enters the async loop machinery.
  const writeGuarded = (
    state: TPersistedState,
    generation: number,
  ): void | Promise<void> => {
    try {
      const result = attemptWrite(state);
      if (result instanceof Promise) {
        return result.catch((error) => {
          if (!options.retryWrite) throw error; // → writeSafe's containment
          return retryLoop(state, error, generation);
        });
      }
    } catch (error) {
      if (!options.retryWrite) throw error; // → writeSafe's containment
      return retryLoop(state, error, generation);
    }
  };

  const writeToStorage = () => {
    const state = getPersistedSlice();
    const generation = ++writeGeneration;
    // skipPersist semantics are on the option JSDoc (evaluated against the
    // partialized slice). The removal is never retried (`retryWrite` covers
    // setItem only), but it DOES start a new generation above — a stale retry
    // loop must not resurrect a key the removal just deleted.
    if (options.skipPersist?.(state)) {
      return storage!.removeItem(options.name);
    }
    return writeGuarded(state, generation);
  };

  // Contain write throws/rejections: a sync `setItem` quota throw or an async
  // `setItem` rejection must never propagate through the effect flush into the
  // caller's `setState` (nor a throwing `retryWrite` out of the retry loop).
  // Route to `onError`, else the (dev-only) `console.error` fallback in
  // `reportError` — a failing write always leaves a signal in dev. Returns the
  // in-flight promise so the post-migrate write-back can await settlement.
  const writeSafe = (): void | Promise<void> => {
    try {
      const result = writeToStorage();
      if (result instanceof Promise) {
        return result.catch((error) => reportError(error, "write"));
      }
    } catch (error) {
      reportError(error, "write");
    }
  };

  // Trailing-only throttle for subscribe-writes (`throttleMs`). One plain
  // setTimeout handle: the first eligible setState schedules it, calls during
  // the window coalesce, and the flush calls `writeSafe` — which reads
  // `source.getState()` at execution, so the LATEST state wins for free.
  let throttleTimer: ReturnType<typeof setTimeout> | undefined;

  const cancelPendingWrite = () => {
    if (throttleTimer === undefined) return;
    clearTimeout(throttleTimer);
    throttleTimer = undefined;
  };

  // Flush a pending throttled write NOW — one plain attempt so no data is
  // lost at teardown. No-op when nothing is pending. `noRetry` (teardown):
  // bypass the retryWrite loop and report a failure directly — destroy()'s
  // generation bump would otherwise abandon the loop silently and the flush
  // error would never reach `onError`.
  const flushPendingWrite = (mode?: "noRetry") => {
    if (throttleTimer === undefined) return;
    cancelPendingWrite();
    if (mode === "noRetry") {
      try {
        const result = attemptWrite(getPersistedSlice());
        if (result instanceof Promise) {
          result.catch((error) => reportError(error, "write"));
        }
      } catch (error) {
        reportError(error, "write");
      }
      return;
    }
    writeSafe();
  };

  // Subscribe-write entry point: immediate without `throttleMs`; otherwise
  // trailing throttle — EXCEPT skipPersist removals, which stay immediate (a
  // reset-to-default must drop the key now) and cancel any pending write (the
  // removal supersedes the older state it would have flushed).
  const scheduleWrite = () => {
    if (options.throttleMs === undefined) {
      writeSafe();
      return;
    }
    if (options.skipPersist?.(getPersistedSlice())) {
      cancelPendingWrite();
      writeSafe(); // takes writeToStorage's removeItem branch
      return;
    }
    // Every coalesced setState supersedes older in-flight work NOW, not at
    // flush time — the retryWrite contract ("a newer setState abandons an
    // in-flight retry loop") must hold even while the newer state sits in
    // the timer, or a stale shrunk payload could land mid-window.
    writeGeneration++;
    if (throttleTimer !== undefined) return; // coalesce into the pending flush
    throttleTimer = setTimeout(() => {
      throttleTimer = undefined;
      // Re-check the hydration gate at FLUSH time: a rehydrate may have
      // started inside the window (crossTab / manual), and a stale flush
      // mid-hydration would race the storage read (subscribe-writes are
      // gated on `hasHydrated` — the gate applies when the write happens,
      // not when it was scheduled). The pending state is safely dropped:
      // hydrate is about to overwrite in-memory state anyway.
      if (!hasHydratedFlag) return;
      writeSafe();
    }, options.throttleMs);
  };

  // Retain the source subscription + registry unregister so `destroy()` can
  // detach both — otherwise a non-singleton persisted store (created per
  // mount/scope) leaks a subscription + registry entry per mount and keeps
  // writing after unmount.
  const sourceSubscription = source.subscribe(() => {
    if (!hasHydratedFlag) {
      // A user setState during an async hydrate — the gate drops it (a stale
      // flush would race the storage read); re-scheduled after settle. Skip the
      // persist-core-driven merge (`internalSetState`) — not a user write to recover.
      if (!internalSetState) writeSkippedDuringHydrate = true;
      return;
    }
    scheduleWrite();
  });

  // Cross-tab listener (behavioral contract documented on the `crossTab`
  // option). Guard mirrors TanStack DB's `local-storage.ts` reference:
  // `event.key === name` AND `event.storageArea === raw backend` — the codec
  // wrapper hides the raw `Storage`, so `createStorage` re-exposes it as
  // `PersistStorage.raw`; without it (hand-rolled storage) matching is
  // key-only. No target resolvable (SSR / no window) → silently skip.
  let crossTabListener: ((event: CrossTabStorageEvent) => void) | undefined;
  let crossTabTarget: CrossTabEventTarget | undefined;
  if (options.crossTab) {
    const target: CrossTabEventTarget | undefined =
      options.crossTabEventTarget ??
      (typeof window !== "undefined" &&
      typeof window.addEventListener === "function"
        ? (window as unknown as CrossTabEventTarget)
        : undefined);
    if (target) {
      crossTabListener = (event) => {
        if (event.key !== options.name) return;
        const raw = storage?.raw;
        if (
          raw !== undefined &&
          event.storageArea != null &&
          event.storageArea !== raw
        ) {
          return;
        }
        // Key REMOVED in the other tab: rehydrate can't express "reset"
        // (`getItem → null` keeps current state), so `onCrossTabRemove` owns
        // removal semantics. Read from `options` at event time so
        // `setOptions` can swap it. Without the callback, fall back to
        // rehydrate — the documented keep-state divergence.
        if (event.newValue === null && options.onCrossTabRemove) {
          try {
            options.onCrossTabRemove();
          } catch (error) {
            reportError(error, "crossTab");
          }
          return;
        }
        void api.rehydrate();
      };
      target.addEventListener("storage", crossTabListener);
      crossTabTarget = target;
    }
  }

  // Expiry runs BEFORE version/migrate — expired data is never migrated.
  // Both maxAge and buster misses collapse to "no stored state", so hydrate
  // keeps the current state (contracts on the `maxAge` / `buster` options).
  const isStoredExpired = (stored: StorageValue<TPersistedState>): boolean => {
    if (
      options.maxAge !== undefined &&
      Date.now() - (stored.timestamp ?? 0) > options.maxAge
    ) {
      return true;
    }
    return options.buster !== undefined && stored.buster !== options.buster;
  };

  // Resolve a non-expired stored payload into the state to merge, running
  // `migrate` when versions differ. `state: undefined` = nothing usable
  // (version mismatch without a migrate fn — reported, not thrown).
  const resolveStoredState = async (
    stored: StorageValue<TPersistedState>,
  ): Promise<{ state: TPersistedState | undefined; migrated: boolean }> => {
    if (
      typeof stored.version === "number" &&
      stored.version !== options.version
    ) {
      if (options.migrate) {
        return {
          state: await options.migrate(stored.state, stored.version),
          migrated: true,
        };
      }
      reportError(
        new Error(
          `[persistStore] State loaded from storage couldn't be migrated — no migrate function provided`,
        ),
        "migrate",
      );
      return { state: undefined, migrated: false };
    }
    return { state: stored.state, migrated: false };
  };

  // Hydration-start prologue: notify start listeners and capture the optional
  // post-rehydration callback from `onRehydrateStorage`. Either may throw —
  // the caller's catch owns containment.
  const beginHydration = ():
    | ((state?: TState, error?: unknown) => void)
    | undefined => {
    for (const cb of hydrationListeners) cb(source.getState());
    return options.onRehydrateStorage?.(source.getState()) || undefined;
  };

  // Expiry classification (runs before version/migrate — see isStoredExpired):
  // `live` is the payload to resolve, `null` when nothing usable was stored.
  // `!= null` (not `!== null`) — tolerate out-of-contract storages whose
  // getItem resolves `undefined`; both count as "no stored state".
  const partitionExpired = (
    stored: StorageValue<TPersistedState> | null | undefined,
  ): { expired: boolean; live: StorageValue<TPersistedState> | null } => {
    const expired = stored != null && isStoredExpired(stored);
    return { expired, live: stored != null && !expired ? stored : null };
  };

  // Merge step: land the resolved state into the source via the configured
  // merge (default shallow spread). `undefined` = nothing usable — the source
  // keeps its current/initial state.
  const applyResolvedState = (migratedState: TPersistedState | undefined) => {
    if (migratedState === undefined) return;
    const merge = options.merge ?? shallowSpreadMerge;
    // Mark this as persist-core's own setState so the subscribe gate doesn't
    // record it as a user write to re-schedule (the merge is not a write event).
    internalSetState = true;
    try {
      source.setState(() => merge(migratedState, source.getState()));
    } finally {
      internalSetState = false;
    }
  };

  // Shared finish/fail epilogue: settle the post-rehydration callback, flip
  // the flag, notify finish-hydration listeners. Failed hydrate still ends
  // hydration — flip the flag or subscribe-writes stay gated forever.
  // The flag flips BEFORE the callbacks run so a throwing user callback
  // can't double-settle: the caller checks `hasHydratedFlag` and treats a
  // post-settle throw as report-only (listeners never run twice).
  const settleHydration = (
    postRehydrationCallback:
      | ((state?: TState, error?: unknown) => void)
      | undefined,
    failure?: { error: unknown },
  ) => {
    hasHydratedFlag = true;
    if (failure) {
      postRehydrationCallback?.(undefined, failure.error);
    } else {
      postRehydrationCallback?.(source.getState(), undefined);
    }
    for (const cb of finishHydrationListeners) cb(source.getState());
  };

  // Returns the hydrate promise so `rehydrate()` (and the initial hydrate) can
  // be awaited — mirrors zustand's `rehydrate: () => hydrate()` thenable chain.
  // The `hydrationVersion` race-guard early-returns resolve the promise without
  // flipping `hasHydratedFlag`; a winning rehydrate owns that flip. The step
  // helpers above are sync (or awaited in place) on purpose so every guard
  // sits directly at an await boundary — no state mutation can slip between
  // an await and its guard.
  const hydrate = async (): Promise<void> => {
    if (!storage) return;

    const currentVersion = ++hydrationVersion;
    hasHydratedFlag = false;
    writeSkippedDuringHydrate = false;
    // A pending throttled write predates this hydrate — cancel it (a stale
    // flush must not race the storage read), but REMEMBER it: if this
    // hydrate wins, the state it captured is still current post-merge and
    // must be re-scheduled, or a rehydrate that finds nothing usable would
    // silently strand unpersisted state until the next setState.
    const hadPendingWrite = throttleTimer !== undefined;
    cancelPendingWrite();
    // Supersede any in-flight retryWrite loop for the same reason: its
    // captured pre-hydration state must not commit AFTER this hydrate merges
    // fresher storage state (the loop abandons silently at its next
    // generation check). The migrate write-back and the re-scheduled pending
    // write below capture fresh generations of their own.
    writeGeneration++;

    // Assigned inside the try: a throwing `onHydrate` listener or
    // `onRehydrateStorage` factory must land in the catch below (reported +
    // hydration ended), not escape as an unhandled rejection from the
    // fire-and-forget `void hydrate()` / crossTab `void api.rehydrate()` calls.
    let postRehydrationCallback:
      | ((state?: TState, error?: unknown) => void)
      | undefined;
    // Distinguish a throwing user `migrate()` (phase "migrate") from storage
    // read failures (phase "hydrate") in the shared catch.
    let errorPhase: "hydrate" | "migrate" = "hydrate";

    try {
      postRehydrationCallback = beginHydration();

      const stored = await storage!.getItem(options.name);
      if (currentVersion !== hydrationVersion) return;

      const { expired, live } = partitionExpired(stored);
      if (expired) {
        await storage!.removeItem(options.name);
        if (currentVersion !== hydrationVersion) return;
      }

      errorPhase = "migrate";
      const resolved = live
        ? await resolveStoredState(live)
        : { state: undefined, migrated: false };
      errorPhase = "hydrate";

      if (currentVersion !== hydrationVersion) return;

      applyResolvedState(resolved.state);

      if (resolved.migrated) {
        // State already hydrated + merged — a failing write-back is a "write"
        // error, not a failed hydration; `writeSafe` contains + reports it
        // (running the `retryWrite` loop when configured) and hydration
        // finishes normally. Not throttled — the write-back is one-shot.
        await writeSafe();
      }

      if (currentVersion !== hydrationVersion) return;

      settleHydration(postRehydrationCallback);
      // Re-schedule the write this hydrate cancelled on entry, OR a user
      // setState that the subscribe gate dropped during the async window: the
      // state it captured is still the current state (post-merge), and dropping
      // it would leave storage stale until the next setState.
      if (hadPendingWrite || writeSkippedDuringHydrate) scheduleWrite();
    } catch (error: unknown) {
      if (currentVersion !== hydrationVersion) return;
      reportError(error, errorPhase);
      // A throw AFTER settleHydration (a throwing finish listener or
      // post-rehydration callback) is report-only: `hasHydratedFlag` is this
      // invocation's settled-sentinel (the version guard above excludes a
      // newer hydrate's flag reset), and settling again would re-run every
      // listener and let a second throw escape the fire-and-forget callers.
      if (hasHydratedFlag) return;
      try {
        settleHydration(postRehydrationCallback, { error });
      } catch (settleError) {
        reportError(settleError, "hydrate");
      } finally {
        if (hadPendingWrite || writeSkippedDuringHydrate) scheduleWrite();
      }
    }
  };

  if (!options.skipHydration) {
    void hydrate();
  }

  // Register the clear callback only when a `registry` is wired. The closure
  // reads `api` (declared just below) only when invoked during
  // `registry.clearAll()` — long after `api` is bound — so the forward
  // reference is safe.
  const unregisterClear = options.registry?.register(() => api.clearStorage());

  const api: PersistApi<TState, TPersistedState> = {
    setOptions(newOptions) {
      // Skip explicit `undefined` entries so `{ merge: undefined }` can't
      // clobber the default — only real values win.
      options = mergeDefined(options, newOptions);
      if (newOptions.storage) {
        storage = newOptions.storage;
      }
    },
    clearStorage() {
      // Cancel any pending throttled write + supersede in-flight retryWrite
      // before removing the key — otherwise a pending timer or retry loop
      // resurrects the key after the clear (also affects registry.clearAll()).
      cancelPendingWrite();
      writeGeneration++;
      return storage?.removeItem(options.name);
    },
    rehydrate: hydrate,
    hasHydrated: () => hasHydratedFlag,
    onHydrate(fn) {
      hydrationListeners.add(fn);
      return () => hydrationListeners.delete(fn);
    },
    onFinishHydration(fn) {
      finishHydrationListeners.add(fn);
      return () => finishHydrationListeners.delete(fn);
    },
    getOptions: () => options,
    destroy() {
      sourceSubscription.unsubscribe();
      unregisterClear?.();
      if (crossTabListener && crossTabTarget) {
        crossTabTarget.removeEventListener("storage", crossTabListener);
      }
      // Flush any pending throttled write FIRST (no data lost at teardown),
      // THEN bump the cancellation counters below. `noRetry`: the flush must
      // not enter the retryWrite loop — the generation bump below would
      // abandon it silently and a teardown-flush failure would never reach
      // `onError`; the direct attempt reports it.
      flushPendingWrite("noRetry");
      // Cancel any in-flight hydrate via the existing race guard — otherwise a
      // pending async getItem/migrate would still setState, flip the flag, and
      // (on the migrated path) re-write the storage key after teardown.
      hydrationVersion++;
      // Supersede any in-flight retryWrite loop — it abandons silently at its
      // next generation check instead of writing after teardown.
      writeGeneration++;
    },
  };

  return api;
}
