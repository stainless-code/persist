import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { MemoryStorage } from "../testing/memory-storage";
import {
  createJSONStorage,
  createMigrationChain,
  createPersistRegistry,
  createStorage,
  identityCodec,
  jsonCodec,
  persistSource,
} from "./persist-core";
import type {
  CrossTabEventTarget,
  CrossTabStorageEvent,
  PersistableSource,
  StateStorage,
  StorageValue,
} from "./persist-core";

describe("persist-core zero-dep gate", () => {
  it("persist-core.ts has no value imports (zero-dep core contract)", async () => {
    const source = await Bun.file(
      new URL("./persist-core.ts", import.meta.url),
    ).text();
    // Type-only imports vanish at compile time; any other import is a runtime
    // dependency edge and breaks the zero-dep core contract.
    const valueImports = source
      .split("\n")
      .filter((line) => /^import\s/.test(line) && !/^import type\s/.test(line));
    expect(valueImports).toEqual([]);
  });

  it("tanstack-store.ts imports @tanstack/store as types only", async () => {
    const source = await Bun.file(
      new URL("../adapters/sources/tanstack-store.ts", import.meta.url),
    ).text();
    const storeValueImports = source
      .split("\n")
      .filter(
        (line) =>
          /^import\s.*@tanstack\/store/.test(line) &&
          !/^import type\s/.test(line),
      );
    expect(storeValueImports).toEqual([]);
  });
});

function createMockSource<T>(initial: T): PersistableSource<T> & { state: T } {
  let state = initial;
  const listeners = new Set<() => void>();

  return {
    get state() {
      return state;
    },
    getState: () => state,
    setState: (updater) => {
      state = updater(state);
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return {
        unsubscribe: () => listeners.delete(listener),
      };
    },
  };
}

function waitForHydration(hasHydrated: () => boolean, maxTicks = 10_000) {
  return new Promise<void>((resolve, reject) => {
    let ticks = 0;
    const tick = () => {
      if (hasHydrated()) {
        resolve();
        return;
      }
      // Bounded: a hydration regression fails loudly here instead of hanging
      // the suite until the runner's opaque timeout.
      if (++ticks > maxTicks) {
        reject(new Error("waitForHydration: never hydrated"));
        return;
      }
      queueMicrotask(tick);
    };
    tick();
  });
}

describe("createJSONStorage codec seam", () => {
  let memory: MemoryStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  it("round-trips plain JSON values", async () => {
    const storage = createJSONStorage<{ count: number }>(() => memory)!;
    await storage.setItem("test", { state: { count: 5 }, version: 0 });
    const stored = await storage.getItem("test");
    expect(stored?.state.count).toBe(5);
  });

  it("returns null for corrupt payloads (unified with seroval — no throw into hydrate)", async () => {
    memory.setItem("bad", "{not-json");

    const storage = createJSONStorage<{ count: number }>(() => memory)!;
    expect(await storage.getItem("bad")).toBeNull();
  });

  it("clearCorruptOnFailure removes the key on a corrupt JSON payload", async () => {
    memory.setItem("corrupt", "{not-json");

    const storage = createStorage<{ count: number }>(
      () => memory,
      jsonCodec<{ count: number }>(),
      { clearCorruptOnFailure: true },
    )!;

    expect(await storage.getItem("corrupt")).toBeNull();
    expect(memory.getItem("corrupt")).toBeNull();
  });

  it("createStorage returns undefined when getStorage throws", () => {
    expect(
      createStorage<{ count: number }>(() => {
        throw new Error("no storage");
      }, jsonCodec<{ count: number }>()),
    ).toBeUndefined();
  });

  it("createStorage returns undefined for a defined-but-broken backend (Node 22+ localStorage without --localstorage-file)", () => {
    // Node 22+ exposes `localStorage` as an object whose methods are undefined
    // when no valid --localstorage-file path is configured. The lookup doesn't
    // throw, so the shape check — not the try/catch — must catch it.
    const brokenBackend = {
      getItem: undefined,
      setItem: undefined,
      removeItem: undefined,
    } as unknown as StateStorage;
    expect(
      createStorage<{ count: number }>(
        () => brokenBackend,
        jsonCodec<{ count: number }>(),
      ),
    ).toBeUndefined();
  });

  it("createStorage returns undefined when the backend is missing one method", () => {
    const partialBackend = {
      getItem: () => null,
      setItem: () => {},
      // removeItem missing
    } as unknown as StateStorage;
    expect(
      createStorage<{ count: number }>(
        () => partialBackend,
        jsonCodec<{ count: number }>(),
      ),
    ).toBeUndefined();
  });

  it("generic wire type: identityCodec over an object-valued backend round-trips with no serialization", async () => {
    // Pins the StateStorage<TRaw> seam (pre-freeze seam decision 1): a
    // structured-clone-style backend stores the envelope object natively.
    interface State {
      tags: Set<string>;
    }
    const objects = new Map<string, StorageValue<State>>();
    const objectBackend: StateStorage<StorageValue<State>> = {
      getItem: (name) => objects.get(name) ?? null,
      setItem: (name, value) => {
        objects.set(name, value);
      },
      removeItem: (name) => {
        objects.delete(name);
      },
    };

    const storage = createStorage<State, StorageValue<State>>(
      () => objectBackend,
      identityCodec<State>(),
    )!;

    await storage.setItem("obj", {
      state: { tags: new Set(["x"]) },
      version: 0,
    });
    // The backend holds the exact envelope object — identity, not a copy.
    expect(objects.get("obj")?.state.tags instanceof Set).toBe(true);
    const stored = await storage.getItem("obj");
    expect(stored?.state.tags).toEqual(new Set(["x"]));
  });
});

describe("persistSource", () => {
  let memory: MemoryStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  it("hydrates persisted state before writing", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    await jsonStorage.setItem("counter", { state: { count: 5 }, version: 0 });

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "counter",
      storage: jsonStorage,
    });

    await waitForHydration(persist.hasHydrated);
    expect(source.state.count).toBe(5);

    source.setState((prev) => ({ ...prev, count: prev.count + 1 }));
    await waitForHydration(() => memory.getItem("counter") !== null);

    const stored = await jsonStorage.getItem("counter");
    expect(stored?.state.count).toBe(6);
  });

  it("partialize filters persisted fields", async () => {
    const source = createMockSource({ keep: 1, drop: "secret" });
    const jsonStorage = createJSONStorage<{ keep: number }>(() => memory)!;

    const persist = persistSource(source, {
      name: "partial",
      storage: jsonStorage,
      partialize: (state) => ({ keep: state.keep }),
    });

    await waitForHydration(persist.hasHydrated);
    source.setState((prev) => ({ ...prev, keep: 2, drop: "changed" }));

    await new Promise((resolve) => queueMicrotask(resolve));

    const stored = await jsonStorage.getItem("partial");
    expect(stored?.state).toEqual({ keep: 2 });
    expect(stored?.state).not.toHaveProperty("drop");
  });

  it("runs migrate when stored version differs", async () => {
    const jsonStorage = createJSONStorage<{ value: string }>(() => memory)!;
    await jsonStorage.setItem("migrated", {
      state: { value: "old" },
      version: 0,
    });

    const source = createMockSource({ value: "initial" });
    const persist = persistSource(source, {
      name: "migrated",
      storage: jsonStorage,
      version: 1,
      migrate: (persisted) => ({
        value: `${(persisted as { value: string }).value}-migrated`,
      }),
    });

    await waitForHydration(persist.hasHydrated);
    expect(source.state.value).toBe("old-migrated");

    const stored = await jsonStorage.getItem("migrated");
    expect(stored?.version).toBe(1);
    expect(stored?.state.value).toBe("old-migrated");
  });

  it("rehydrate is awaitable — resolves after merge + finish-hydration listeners ran", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    await jsonStorage.setItem("awaitable", {
      state: { count: 11 },
      version: 0,
    });

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "awaitable",
      storage: jsonStorage,
      skipHydration: true,
    });

    const finishCalls: number[] = [];
    persist.onFinishHydration((state) => finishCalls.push(state.count));

    await persist.rehydrate();

    // Awaiting rehydrate guarantees the merge landed and listeners already ran.
    expect(source.state.count).toBe(11);
    expect(persist.hasHydrated()).toBe(true);
    expect(finishCalls).toEqual([11]);
  });

  it("contains sync storage write errors — setState never throws, onError receives the error", async () => {
    const errors: Array<{ error: unknown; phase: string }> = [];
    const throwingStorage: StateStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
      removeItem: () => {},
    };

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "throwing",
      storage: createJSONStorage<{ count: number }>(() => throwingStorage)!,
      onError: (error, context) => errors.push({ error, phase: context.phase }),
    });

    await waitForHydration(persist.hasHydrated);

    // setState must not throw even though the backend throws synchronously.
    expect(() =>
      source.setState((prev) => ({ ...prev, count: 1 })),
    ).not.toThrow();

    await new Promise((resolve) => queueMicrotask(resolve));
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0].phase).toBe("write");
    expect((errors[0].error as Error).message).toContain("quota exceeded");
  });

  it("contains async storage write rejections via onError", async () => {
    const errors: Array<{ phase: string; message: string }> = [];
    const asyncRejectStorage: StateStorage = {
      getItem: () => null,
      setItem: () => Promise.reject(new Error("async quota")),
      removeItem: () => {},
    };

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "async-throw",
      storage: createJSONStorage<{ count: number }>(() => asyncRejectStorage)!,
      onError: (error, context) =>
        errors.push({
          phase: context.phase,
          message: (error as Error).message,
        }),
    });

    await waitForHydration(persist.hasHydrated);
    expect(() =>
      source.setState((prev) => ({ ...prev, count: 2 })),
    ).not.toThrow();

    await new Promise((resolve) => queueMicrotask(resolve));
    expect(errors).toContainEqual({
      phase: "write",
      message: "async quota",
    });
  });

  it("write errors without onError fall back to console.error in dev — setState still never throws (fallback is dev-gated: prod without a sink is silent)", async () => {
    const throwingStorage: StateStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
      removeItem: () => {},
    };

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "throwing-unset",
      storage: createJSONStorage<{ count: number }>(() => throwingStorage)!,
    });
    await waitForHydration(persist.hasHydrated);

    const originalConsoleError = console.error;
    const logged: unknown[][] = [];
    console.error = (...args: unknown[]) => {
      logged.push(args);
    };
    try {
      expect(() =>
        source.setState((prev) => ({ ...prev, count: 1 })),
      ).not.toThrow();
    } finally {
      console.error = originalConsoleError;
    }

    expect(logged.length).toBe(1);
    expect(String(logged[0][0])).toContain("write error for 'throwing-unset'");
  });

  it("hydrate read failures route to onError with phase 'hydrate' and still end hydration", async () => {
    const errors: Array<{ phase: string; message: string }> = [];
    const failingReadStorage: StateStorage = {
      getItem: () => Promise.reject(new Error("read failed")),
      setItem: () => {},
      removeItem: () => {},
    };

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "read-fail",
      storage: createJSONStorage<{ count: number }>(() => failingReadStorage)!,
      onError: (error, context) =>
        errors.push({
          phase: context.phase,
          message: (error as Error).message,
        }),
    });

    await waitForHydration(persist.hasHydrated);
    expect(errors).toContainEqual({ phase: "hydrate", message: "read failed" });
  });

  it("version mismatch without a migrate fn routes to onError with phase 'migrate'", async () => {
    const memoryStorage = new MemoryStorage();
    const jsonStorage = createJSONStorage<{ count: number }>(
      () => memoryStorage,
    )!;
    await jsonStorage.setItem("no-migrate", {
      state: { count: 9 },
      version: 1,
    });

    const errors: Array<{ phase: string }> = [];
    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "no-migrate",
      storage: jsonStorage,
      version: 2,
      onError: (_error, context) => errors.push({ phase: context.phase }),
    });

    await waitForHydration(persist.hasHydrated);
    // Nothing usable → state stays initial; error reported as migrate-phase.
    expect(source.state.count).toBe(0);
    expect(errors).toContainEqual({ phase: "migrate" });
  });

  it("a throwing migrate fn is reported with phase 'migrate', not 'hydrate'", async () => {
    const memoryStorage = new MemoryStorage();
    const jsonStorage = createJSONStorage<{ count: number }>(
      () => memoryStorage,
    )!;
    await jsonStorage.setItem("migrate-throws", {
      state: { count: 3 },
      version: 1,
    });

    const errors: Array<{ phase: string; message: string }> = [];
    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "migrate-throws",
      storage: jsonStorage,
      version: 2,
      migrate: () => {
        throw new Error("bad migration");
      },
      onError: (error, context) =>
        errors.push({
          phase: context.phase,
          message: (error as Error).message,
        }),
    });

    await waitForHydration(persist.hasHydrated);
    expect(errors).toContainEqual({
      phase: "migrate",
      message: "bad migration",
    });
  });

  it("storage unavailable at create time routes to onError instead of console.warn", () => {
    const errors: Array<{ phase: string; message: string }> = [];
    const savedLocalStorage = globalThis.localStorage;
    // @ts-expect-error force the no-default-storage path
    delete globalThis.localStorage;
    try {
      const source = createMockSource({ count: 0 });
      const persist = persistSource(source, {
        name: "unavailable",
        onError: (error, context) =>
          errors.push({
            phase: context.phase,
            message: (error as Error).message,
          }),
      });
      expect(persist.hasHydrated()).toBe(true);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("storage unavailable");
    } finally {
      if (savedLocalStorage !== undefined) {
        globalThis.localStorage = savedLocalStorage;
      }
    }
  });

  it("defined-but-broken localStorage (Node 22+ without --localstorage-file) collapses to the no-op path, not a hydrate crash", () => {
    // Reproduces the SSR crash: `typeof localStorage === "undefined"` is
    // false for Node 22+'s half-built global, so without the `createStorage`
    // shape check the default JSON storage passes availability and `hydrate`
    // throws `storage.getItem is not a function`. Assert the no-op path.
    const errors: Array<{ phase: string; message: string }> = [];
    const savedLocalStorage = globalThis.localStorage;
    // Object present, methods absent; cast through `unknown` — the shape
    // check guards this at runtime.
    globalThis.localStorage = {
      getItem: undefined,
      setItem: undefined,
      removeItem: undefined,
    } as unknown as typeof globalThis.localStorage;
    try {
      const source = createMockSource({ count: 0 });
      const persist = persistSource(source, {
        name: "broken-backend",
        onError: (error, context) =>
          errors.push({
            phase: context.phase,
            message: (error as Error).message,
          }),
      });
      expect(persist.hasHydrated()).toBe(true);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("storage unavailable");
    } finally {
      if (savedLocalStorage === undefined) {
        // @ts-expect-error restore the undefined global
        delete globalThis.localStorage;
      } else {
        globalThis.localStorage = savedLocalStorage;
      }
    }
  });

  it("a throwing onFinishHydration listener is contained — reported once, no double-settle, no unhandled rejection", async () => {
    const memoryStorage = new MemoryStorage();
    const jsonStorage = createJSONStorage<{ count: number }>(
      () => memoryStorage,
    )!;
    await jsonStorage.setItem("throwing-listener", {
      state: { count: 4 },
      version: 0,
    });

    const errors: Array<string> = [];
    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "throwing-listener",
      storage: jsonStorage,
      skipHydration: true,
      onError: (error) => errors.push((error as Error).message),
    });

    let finishCalls = 0;
    persist.onFinishHydration(() => {
      finishCalls++;
      throw new Error("listener exploded");
    });

    // The awaitable rehydrate must RESOLVE (not reject) — the throw is
    // contained, reported once, and the listener never re-runs via a
    // second settle.
    await persist.rehydrate();
    expect(finishCalls).toBe(1);
    expect(errors).toEqual(["listener exploded"]);
    expect(persist.hasHydrated()).toBe(true);
    expect(source.state.count).toBe(4); // merge landed before the throw
  });

  it("destroy() cancels an in-flight hydrate — no setState or flag flip after teardown", async () => {
    let resolveGet: ((value: string | null) => void) | undefined;
    const delayedStorage: StateStorage = {
      getItem: () =>
        new Promise((resolve) => {
          resolveGet = resolve;
        }),
      setItem: () => {},
      removeItem: () => {},
    };

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "destroy-inflight",
      storage: createJSONStorage<{ count: number }>(() => delayedStorage)!,
    });

    persist.destroy();
    resolveGet?.(JSON.stringify({ state: { count: 42 }, version: 0 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The race guard (bumped by destroy) discards the pending hydrate.
    expect(source.state.count).toBe(0);
    expect(persist.hasHydrated()).toBe(false);
  });

  it("discards stale hydration when rehydrate races", async () => {
    const pendingGets: Array<(value: string | null) => void> = [];
    const delayedStorage: StateStorage = {
      getItem: () =>
        new Promise((resolve) => {
          pendingGets.push(resolve);
        }),
      setItem: (name, value) => memory.setItem(name, value),
      removeItem: (name) => memory.removeItem(name),
    };

    const jsonStorage = createJSONStorage<{ label: string }>(
      () => delayedStorage,
    )!;

    const source = createMockSource({ label: "current" });
    const persist = persistSource(source, {
      name: "race",
      storage: jsonStorage,
      skipHydration: true,
    });

    void persist.rehydrate();
    void persist.rehydrate();

    pendingGets[1]?.(null);
    await waitForHydration(persist.hasHydrated);

    pendingGets[0]?.(JSON.stringify({ state: { label: "stale" }, version: 0 }));

    await new Promise((resolve) => queueMicrotask(resolve));
    expect(source.state.label).toBe("current");
  });

  it("clearStorage removes the persisted key", async () => {
    const source = createMockSource({ count: 1 });
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;

    const persist = persistSource(source, {
      name: "clear-me",
      storage: jsonStorage,
    });

    await waitForHydration(persist.hasHydrated);
    source.setState((prev) => ({ ...prev, count: 2 }));
    await new Promise((resolve) => queueMicrotask(resolve));
    expect(await jsonStorage.getItem("clear-me")).not.toBeNull();

    await persist.clearStorage();
    expect(await jsonStorage.getItem("clear-me")).toBeNull();
  });

  it("skipPersist removes storage instead of writing", async () => {
    const source = createMockSource({ active: false });
    const jsonStorage = createJSONStorage<{ active: boolean }>(() => memory)!;

    const persist = persistSource(source, {
      name: "skip-empty",
      storage: jsonStorage,
      skipPersist: (state) => !state.active,
    });

    await waitForHydration(persist.hasHydrated);
    source.setState(() => ({ active: true }));
    await new Promise((resolve) => queueMicrotask(resolve));
    expect(await jsonStorage.getItem("skip-empty")).not.toBeNull();

    source.setState(() => ({ active: false }));
    await new Promise((resolve) => queueMicrotask(resolve));
    expect(await jsonStorage.getItem("skip-empty")).toBeNull();
  });
});

describe("persistApi.destroy", () => {
  let memory: MemoryStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  afterEach(() => {
    memory.clear();
  });

  it("after destroy, setState writes nothing and registry.clearAll skips the key", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    const registry = createPersistRegistry();
    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "destroyed",
      storage: jsonStorage,
      registry,
    });

    await waitForHydration(persist.hasHydrated);
    source.setState((prev) => ({ ...prev, count: 5 }));
    await new Promise((resolve) => queueMicrotask(resolve));
    expect(await jsonStorage.getItem("destroyed")).not.toBeNull();

    persist.destroy();

    // Wipe the key manually, then prove no further writes happen post-destroy.
    await persist.clearStorage();
    expect(await jsonStorage.getItem("destroyed")).toBeNull();

    source.setState((prev) => ({ ...prev, count: 99 }));
    await new Promise((resolve) => queueMicrotask(resolve));
    expect(await jsonStorage.getItem("destroyed")).toBeNull();

    // The destroyed instance is unregistered — registry.clearAll must not
    // touch a key it owns (re-seed the key, then assert it survives a clear).
    await jsonStorage.setItem("destroyed", { state: { count: 7 }, version: 0 });
    await registry.clearAll();
    expect(await jsonStorage.getItem("destroyed")).not.toBeNull();
  });

  it("create+destroy N instances leaves the registry stable (no leak)", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    const registry = createPersistRegistry();

    for (let i = 0; i < 5; i++) {
      const source = createMockSource({ count: 0 });
      const persist = persistSource(source, {
        name: `leak-${i}`,
        storage: jsonStorage,
        registry,
      });
      await waitForHydration(persist.hasHydrated);
      source.setState((prev) => ({ ...prev, count: i }));
      await new Promise((resolve) => queueMicrotask(resolve));
      persist.destroy();
    }

    // All five keys were written before destroy; registry.clearAll must not
    // touch them because their owners unregistered — proves no registry leak.
    for (let i = 0; i < 5; i++) {
      expect(await jsonStorage.getItem(`leak-${i}`)).not.toBeNull();
    }
    await registry.clearAll();
    for (let i = 0; i < 5; i++) {
      expect(await jsonStorage.getItem(`leak-${i}`)).not.toBeNull();
    }

    // A still-live instance IS cleared — only live entries remain registered.
    const liveSource = createMockSource({ count: 0 });
    const livePersist = persistSource(liveSource, {
      name: "live",
      storage: jsonStorage,
      registry,
    });
    await waitForHydration(livePersist.hasHydrated);
    liveSource.setState((prev) => ({ ...prev, count: 9 }));
    await new Promise((resolve) => queueMicrotask(resolve));
    expect(await jsonStorage.getItem("live")).not.toBeNull();

    await registry.clearAll();
    expect(await jsonStorage.getItem("live")).toBeNull();
  });
});

function createFakeStorageEventTarget() {
  const listeners = new Set<(event: CrossTabStorageEvent) => void>();
  return {
    target: {
      addEventListener: (
        _type: "storage",
        listener: (event: CrossTabStorageEvent) => void,
      ) => {
        listeners.add(listener);
      },
      removeEventListener: (
        _type: "storage",
        listener: (event: CrossTabStorageEvent) => void,
      ) => {
        listeners.delete(listener);
      },
    } satisfies CrossTabEventTarget,
    dispatch(event: CrossTabStorageEvent) {
      listeners.forEach((listener) => listener(event));
    },
    listenerCount: () => listeners.size,
  };
}

describe("persistSource cross-tab", () => {
  let memory: MemoryStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  it("matching storage event triggers rehydrate (key + storageArea)", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    const fake = createFakeStorageEventTarget();

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "crosstab",
      storage: jsonStorage,
      crossTab: true,
      crossTabEventTarget: fake.target,
      skipHydration: true,
    });

    await jsonStorage.setItem("crosstab", { state: { count: 42 }, version: 0 });

    fake.dispatch({
      key: "crosstab",
      newValue: null,
      storageArea: memory,
    });

    await waitForHydration(persist.hasHydrated);
    expect(source.state.count).toBe(42);
  });

  it("ignores storage events for a different key", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    const fake = createFakeStorageEventTarget();

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "mine",
      storage: jsonStorage,
      crossTab: true,
      crossTabEventTarget: fake.target,
      skipHydration: true,
    });

    await jsonStorage.setItem("other", { state: { count: 99 }, version: 0 });

    fake.dispatch({ key: "other", newValue: null, storageArea: memory });
    await new Promise((resolve) => queueMicrotask(resolve));

    expect(persist.hasHydrated()).toBe(false);
    expect(source.state.count).toBe(0);
  });

  it("ignores storage events from a mismatched storageArea (raw present)", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    const fake = createFakeStorageEventTarget();

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "area-guard",
      storage: jsonStorage,
      crossTab: true,
      crossTabEventTarget: fake.target,
      skipHydration: true,
    });

    await jsonStorage.setItem("area-guard", {
      state: { count: 7 },
      version: 0,
    });

    // storageArea !== raw backend (memory) → guard rejects, no rehydrate.
    fake.dispatch({ key: "area-guard", newValue: null, storageArea: {} });
    await new Promise((resolve) => queueMicrotask(resolve));

    expect(persist.hasHydrated()).toBe(false);
    expect(source.state.count).toBe(0);
  });

  it("falls back to key-only matching when raw is absent (hand-rolled PersistStorage)", async () => {
    // Hand-rolled PersistStorage with no `raw` field → cross-tab can't compare
    // storageArea, so it falls back to key-only matching.
    const handRolled = {
      getItem: () => ({ state: { count: 55 }, version: 0 }),
      setItem: () => {},
      removeItem: () => {},
    };
    const fake = createFakeStorageEventTarget();

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "handrolled",
      storage: handRolled,
      crossTab: true,
      crossTabEventTarget: fake.target,
      skipHydration: true,
    });

    fake.dispatch({ key: "handrolled", newValue: null, storageArea: {} });
    await waitForHydration(persist.hasHydrated);

    expect(source.state.count).toBe(55);
  });

  it("listener attaches regardless of skipHydration (manual rehydrate still fires)", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    const fake = createFakeStorageEventTarget();

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "skip-hydrate-crosstab",
      storage: jsonStorage,
      crossTab: true,
      crossTabEventTarget: fake.target,
      skipHydration: true,
    });

    expect(persist.hasHydrated()).toBe(false);
    expect(fake.listenerCount()).toBe(1);

    await jsonStorage.setItem("skip-hydrate-crosstab", {
      state: { count: 13 },
      version: 0,
    });

    fake.dispatch({
      key: "skip-hydrate-crosstab",
      newValue: null,
      storageArea: memory,
    });
    await waitForHydration(persist.hasHydrated);

    expect(source.state.count).toBe(13);
  });

  it("destroy removes the cross-tab listener (no rehydrate after destroy)", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    const fake = createFakeStorageEventTarget();

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "destroy-crosstab",
      storage: jsonStorage,
      crossTab: true,
      crossTabEventTarget: fake.target,
      skipHydration: true,
    });

    expect(fake.listenerCount()).toBe(1);
    persist.destroy();
    expect(fake.listenerCount()).toBe(0);

    await jsonStorage.setItem("destroy-crosstab", {
      state: { count: 77 },
      version: 0,
    });
    fake.dispatch({
      key: "destroy-crosstab",
      newValue: null,
      storageArea: memory,
    });
    await new Promise((resolve) => queueMicrotask(resolve));

    expect(source.state.count).toBe(0);
  });

  it("crossTab off by default — no listener attached (lands dark)", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    const fake = createFakeStorageEventTarget();

    const source = createMockSource({ count: 0 });
    persistSource(source, {
      name: "no-crosstab",
      storage: jsonStorage,
      crossTabEventTarget: fake.target,
    });

    expect(fake.listenerCount()).toBe(0);
  });

  it("no echo loop — overlapping storage events dedupe via the hydrationVersion guard", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    const fake = createFakeStorageEventTarget();

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "echo",
      storage: jsonStorage,
      crossTab: true,
      crossTabEventTarget: fake.target,
      skipHydration: true,
    });

    await jsonStorage.setItem("echo", { state: { count: 1 }, version: 0 });

    // Dispatch two events back-to-back; the second rehydrate bumps
    // `hydrationVersion` and wins — the FIRST in-flight hydrate is the one the
    // race guard discards. The store still ends at the latest value, no throw.
    fake.dispatch({ key: "echo", newValue: null, storageArea: memory });
    fake.dispatch({ key: "echo", newValue: null, storageArea: memory });

    await waitForHydration(persist.hasHydrated);
    expect(source.state.count).toBe(1);
  });

  it("onCrossTabRemove owns key-removal events — callback invoked, no rehydrate", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    const fake = createFakeStorageEventTarget();

    const source = createMockSource({ count: 0 });
    let removeCalls = 0;
    const persist = persistSource(source, {
      name: "remove-owned",
      storage: jsonStorage,
      crossTab: true,
      crossTabEventTarget: fake.target,
      // Consumer-owned reset semantics (e.g. store.actions.reset()).
      onCrossTabRemove: () => {
        removeCalls++;
        source.setState(() => ({ count: 0 }));
      },
    });
    await waitForHydration(persist.hasHydrated);

    // Local tab has non-default state; the other tab reset-to-default
    // (skipPersist removed the key) → removal event arrives.
    source.setState(() => ({ count: 7 }));
    await new Promise((resolve) => queueMicrotask(resolve));

    fake.dispatch({
      key: "remove-owned",
      newValue: null,
      storageArea: memory,
    });
    await new Promise((resolve) => queueMicrotask(resolve));

    expect(removeCalls).toBe(1);
    // Callback reset applied — tabs converge on the default.
    expect(source.state.count).toBe(0);
  });

  it("removal events without onCrossTabRemove fall back to rehydrate (state kept — documented divergence)", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    const fake = createFakeStorageEventTarget();

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "remove-fallback",
      storage: jsonStorage,
      crossTab: true,
      crossTabEventTarget: fake.target,
    });
    await waitForHydration(persist.hasHydrated);

    source.setState(() => ({ count: 7 }));
    await new Promise((resolve) => queueMicrotask(resolve));
    // Simulate the other tab's removal (its skipPersist deleted the key).
    memory.removeItem("remove-fallback");

    fake.dispatch({
      key: "remove-fallback",
      newValue: null,
      storageArea: memory,
    });
    await waitForHydration(persist.hasHydrated);

    // Rehydrate found nothing → local state kept (the divergence
    // `onCrossTabRemove` exists to pair away).
    expect(source.state.count).toBe(7);
  });

  it("non-removal events still rehydrate — onCrossTabRemove not invoked", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    const fake = createFakeStorageEventTarget();

    const source = createMockSource({ count: 0 });
    let removeCalls = 0;
    const persist = persistSource(source, {
      name: "value-event",
      storage: jsonStorage,
      crossTab: true,
      crossTabEventTarget: fake.target,
      onCrossTabRemove: () => {
        removeCalls++;
      },
    });
    await waitForHydration(persist.hasHydrated);

    await jsonStorage.setItem("value-event", {
      state: { count: 3 },
      version: 0,
    });
    fake.dispatch({
      key: "value-event",
      newValue: "ignored-by-guard",
      storageArea: memory,
    });
    await waitForHydration(persist.hasHydrated);

    expect(removeCalls).toBe(0);
    expect(source.state.count).toBe(3);
  });

  it("a throwing onCrossTabRemove is contained and reported with phase 'crossTab'", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    const fake = createFakeStorageEventTarget();
    const errors: Array<{ phase: string; message: string }> = [];

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "remove-throws",
      storage: jsonStorage,
      crossTab: true,
      crossTabEventTarget: fake.target,
      onCrossTabRemove: () => {
        throw new Error("reset failed");
      },
      onError: (error, context) =>
        errors.push({
          phase: context.phase,
          message: (error as Error).message,
        }),
    });
    await waitForHydration(persist.hasHydrated);

    expect(() =>
      fake.dispatch({
        key: "remove-throws",
        newValue: null,
        storageArea: memory,
      }),
    ).not.toThrow();

    expect(errors).toContainEqual({
      phase: "crossTab",
      message: "reset failed",
    });
  });
});

describe("persistSource maxAge + buster", () => {
  let memory: MemoryStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  it("maxAge: payload older than the window discards + removes the key (hydrates to initial)", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    await jsonStorage.setItem("stale", {
      state: { count: 5 },
      version: 0,
      timestamp: Date.now() - 10_000,
    });

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "stale",
      storage: jsonStorage,
      maxAge: 5_000,
    });

    await waitForHydration(persist.hasHydrated);
    expect(source.state.count).toBe(0);
    expect(await jsonStorage.getItem("stale")).toBeNull();
  });

  it("maxAge: payload within the window hydrates normally", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    await jsonStorage.setItem("fresh", {
      state: { count: 8 },
      version: 0,
      timestamp: Date.now() - 1_000,
    });

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "fresh",
      storage: jsonStorage,
      maxAge: 5_000,
    });

    await waitForHydration(persist.hasHydrated);
    expect(source.state.count).toBe(8);
    expect(await jsonStorage.getItem("fresh")).not.toBeNull();
  });

  it("maxAge: missing timestamp counts as expired (legacy payload cleared)", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    await jsonStorage.setItem("legacy", {
      state: { count: 5 },
      version: 0,
    });

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "legacy",
      storage: jsonStorage,
      maxAge: 60_000,
    });

    await waitForHydration(persist.hasHydrated);
    expect(source.state.count).toBe(0);
    expect(await jsonStorage.getItem("legacy")).toBeNull();
  });

  it("buster: mismatch discards + removes the key", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    await jsonStorage.setItem("busted", {
      state: { count: 5 },
      version: 0,
      buster: "old-schema",
    });

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "busted",
      storage: jsonStorage,
      buster: "new-schema",
    });

    await waitForHydration(persist.hasHydrated);
    expect(source.state.count).toBe(0);
    expect(await jsonStorage.getItem("busted")).toBeNull();
  });

  it("buster: matching buster hydrates normally", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    await jsonStorage.setItem("busted-ok", {
      state: { count: 5 },
      version: 0,
      buster: "v1",
    });

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "busted-ok",
      storage: jsonStorage,
      buster: "v1",
    });

    await waitForHydration(persist.hasHydrated);
    expect(source.state.count).toBe(5);
  });

  it("buster: missing buster on the payload mismatches a configured buster (discards)", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    await jsonStorage.setItem("no-buster", {
      state: { count: 5 },
      version: 0,
    });

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "no-buster",
      storage: jsonStorage,
      buster: "v1",
    });

    await waitForHydration(persist.hasHydrated);
    expect(source.state.count).toBe(0);
    expect(await jsonStorage.getItem("no-buster")).toBeNull();
  });

  it("no maxAge/buster: payload without timestamp hydrates byte-identically (no expiry behavior)", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    await jsonStorage.setItem("plain", {
      state: { count: 5 },
      version: 0,
    });

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "plain",
      storage: jsonStorage,
    });

    await waitForHydration(persist.hasHydrated);
    expect(source.state.count).toBe(5);
  });

  it("writeToStorage stamps timestamp always + buster when configured", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    const before = Date.now();
    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "stamp",
      storage: jsonStorage,
      buster: "v1",
    });

    await waitForHydration(persist.hasHydrated);
    source.setState((prev) => ({ ...prev, count: 3 }));
    await new Promise((resolve) => queueMicrotask(resolve));

    const stored = await jsonStorage.getItem("stamp");
    expect(stored?.buster).toBe("v1");
    expect(stored?.timestamp).toBeGreaterThanOrEqual(before);
    expect(stored?.state.count).toBe(3);
  });

  it("expiry runs before migrate — an expired payload with a stale version is not migrated", async () => {
    const jsonStorage = createJSONStorage<{ value: string }>(() => memory)!;
    await jsonStorage.setItem("expire-before-migrate", {
      state: { value: "old" },
      version: 0,
      timestamp: Date.now() - 10_000,
    });

    const migrateCalls: number[] = [];
    const source = createMockSource({ value: "initial" });
    const persist = persistSource(source, {
      name: "expire-before-migrate",
      storage: jsonStorage,
      version: 1,
      maxAge: 5_000,
      migrate: (persisted) => {
        migrateCalls.push(1);
        return { value: `${(persisted as { value: string }).value}-migrated` };
      },
    });

    await waitForHydration(persist.hasHydrated);
    expect(migrateCalls).toEqual([]);
    expect(source.state.value).toBe("initial");
    expect(await jsonStorage.getItem("expire-before-migrate")).toBeNull();
  });
});

describe("persistSource throttleMs", () => {
  let memory: MemoryStorage;
  let setItemCalls: number;
  let countingStorage: StateStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
    setItemCalls = 0;
    countingStorage = {
      getItem: (key) => memory.getItem(key),
      setItem: (key, value) => {
        setItemCalls++;
        memory.setItem(key, value);
      },
      removeItem: (key) => memory.removeItem(key),
    };
  });

  it("burst of setState coalesces into ONE trailing write with the final state", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(
      () => countingStorage,
    )!;
    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "throttled",
      storage: jsonStorage,
      throttleMs: 20,
    });
    await waitForHydration(persist.hasHydrated);

    for (let i = 1; i <= 5; i++) {
      source.setState(() => ({ count: i }));
    }
    // Trailing-only: nothing written until the window elapses.
    expect(setItemCalls).toBe(0);

    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(setItemCalls).toBe(1);
    // State read at flush time — the LAST of the burst is what persisted.
    expect((await jsonStorage.getItem("throttled"))?.state.count).toBe(5);

    // The throttle re-arms after a flush: a later setState writes again.
    source.setState(() => ({ count: 9 }));
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(setItemCalls).toBe(2);
    expect((await jsonStorage.getItem("throttled"))?.state.count).toBe(9);
  });

  it("destroy() flushes the pending throttled write synchronously — no data lost at teardown", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(
      () => countingStorage,
    )!;
    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "throttle-destroy",
      storage: jsonStorage,
      throttleMs: 1_000,
    });
    await waitForHydration(persist.hasHydrated);

    source.setState(() => ({ count: 7 }));
    expect(setItemCalls).toBe(0);

    persist.destroy();
    // Flushed synchronously at teardown, long before the 1s window.
    expect(setItemCalls).toBe(1);
    expect((await jsonStorage.getItem("throttle-destroy"))?.state.count).toBe(
      7,
    );

    // And the cancelled timer never double-fires.
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(setItemCalls).toBe(1);
  });

  it("skipPersist removal bypasses the throttle (immediate) and cancels the pending write", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(
      () => countingStorage,
    )!;
    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "throttle-skip",
      storage: jsonStorage,
      throttleMs: 20,
      skipPersist: (state) => state.count === 0,
    });
    await waitForHydration(persist.hasHydrated);

    // Non-default state schedules a write; reset-to-default before the flush
    // removes the key immediately AND cancels the pending write — otherwise
    // the flush would resurrect the key with pre-reset state.
    source.setState(() => ({ count: 5 }));
    source.setState(() => ({ count: 0 }));

    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(setItemCalls).toBe(0);
    expect(memory.getItem("throttle-skip")).toBeNull();
  });

  it("the post-migrate write-back is NOT throttled (one-shot, immediate)", async () => {
    const jsonStorage = createJSONStorage<{ value: string }>(
      () => countingStorage,
    )!;
    await jsonStorage.setItem("throttle-migrate", {
      state: { value: "old" },
      version: 0,
    });
    setItemCalls = 0;

    const source = createMockSource({ value: "initial" });
    const persist = persistSource(source, {
      name: "throttle-migrate",
      storage: jsonStorage,
      version: 1,
      throttleMs: 60_000,
      migrate: (persisted) => ({
        value: `${(persisted as { value: string }).value}-migrated`,
      }),
    });

    await waitForHydration(persist.hasHydrated);
    // Write-back landed during hydration despite the huge throttle window.
    expect(setItemCalls).toBe(1);
    expect((await jsonStorage.getItem("throttle-migrate"))?.version).toBe(1);
  });

  it("a rehydrate inside the throttle window drops the pending flush — stale state never races the hydrate", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(
      () => countingStorage,
    )!;
    await jsonStorage.setItem("throttle-rehydrate", {
      state: { count: 100 },
      version: 0,
    });
    setItemCalls = 0;

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "throttle-rehydrate",
      storage: jsonStorage,
      throttleMs: 20,
    });
    await waitForHydration(persist.hasHydrated);
    expect(source.state.count).toBe(100);

    // Schedule a throttled write, then rehydrate before the timer fires.
    source.setState(() => ({ count: 1 }));
    expect(setItemCalls).toBe(0);
    await persist.rehydrate();

    // The stale pre-rehydrate flush was cancelled; the winning hydrate
    // re-schedules a write of the CURRENT (merged) state — so storage ends
    // at the hydrated payload, never the stale count:1.
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(setItemCalls).toBe(1);
    expect((await jsonStorage.getItem("throttle-rehydrate"))?.state.count).toBe(
      100,
    );
    // The rehydrate merged storage state back over the in-memory change.
    expect(source.state.count).toBe(100);
  });

  it("a rehydrate that finds nothing usable re-schedules the cancelled write — unpersisted state is not stranded", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(
      () => countingStorage,
    )!;
    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "throttle-rehydrate-empty",
      storage: jsonStorage,
      throttleMs: 20,
    });
    await waitForHydration(persist.hasHydrated);

    // Pending write, then a rehydrate against EMPTY storage: the in-memory
    // state stands, and its cancelled write must be re-scheduled.
    source.setState(() => ({ count: 7 }));
    await persist.rehydrate();
    expect(source.state.count).toBe(7);

    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(setItemCalls).toBe(1);
    expect(
      (await jsonStorage.getItem("throttle-rehydrate-empty"))?.state.count,
    ).toBe(7);
  });

  it("destroy() teardown-flush failure is reported to onError even with retryWrite configured (no silent loss)", async () => {
    const errors: Array<{ phase: string; message: string }> = [];
    let retryCalls = 0;
    const throwingStorage: StateStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("teardown quota");
      },
      removeItem: () => {},
    };

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "teardown-flush",
      storage: createJSONStorage<{ count: number }>(() => throwingStorage)!,
      throttleMs: 60_000,
      retryWrite: () => {
        retryCalls++;
        return;
      },
      onError: (error, context) =>
        errors.push({
          phase: context.phase,
          message: (error as Error).message,
        }),
    });
    await waitForHydration(persist.hasHydrated);

    source.setState(() => ({ count: 1 })); // pending in the throttle window
    persist.destroy();

    // The teardown flush bypasses the retry loop (destroy's generation bump
    // would abandon it silently) and reports the failure directly.
    expect(retryCalls).toBe(0);
    expect(errors).toContainEqual({
      phase: "write",
      message: "teardown quota",
    });
  });

  it("a rehydrate supersedes an in-flight retryWrite loop — stale pre-hydration state never lands post-merge", async () => {
    let failNext = true;
    const written: number[] = [];
    let releaseRetry: ((value: { count: number } | undefined) => void) | null =
      null;
    const backing = new MemoryStorage();
    const flakyStorage: StateStorage = {
      getItem: (name) => backing.getItem(name),
      setItem: (name, value) => {
        if (failNext) {
          failNext = false;
          throw new Error("first write fails");
        }
        written.push(
          (JSON.parse(value) as { state: { count: number } }).state.count,
        );
        backing.setItem(name, value);
      },
      removeItem: (name) => backing.removeItem(name),
    };
    const jsonStorage = createJSONStorage<{ count: number }>(
      () => flakyStorage,
    )!;
    backing.setItem(
      "rehydrate-retry",
      JSON.stringify({ state: { count: 100 }, version: 0 }),
    );

    const errors: unknown[] = [];
    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "rehydrate-retry",
      storage: jsonStorage,
      retryWrite: () =>
        new Promise<{ count: number } | undefined>((resolve) => {
          releaseRetry = resolve;
        }),
      onError: (error) => errors.push(error),
    });
    await waitForHydration(persist.hasHydrated);

    // Failing write starts the retry loop (its promise is now pending).
    source.setState(() => ({ count: 1 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(releaseRetry).not.toBeNull();

    // Rehydrate merges fresher storage state; the in-flight loop must be
    // superseded BEFORE its stale shrunk result can commit.
    await persist.rehydrate();
    expect(source.state.count).toBe(100);

    releaseRetry!({ count: 1 }); // stale — must be discarded silently
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(written).toEqual([]); // no post-hydration stale write
    expect(errors).toEqual([]); // abandoned loops report nothing
    persist.destroy();
  });

  it("a coalesced setState during the window abandons an in-flight retryWrite loop (generation bumps at schedule time)", async () => {
    let failNext = true;
    const writes: number[] = [];
    let releaseRetry: ((value: { count: number } | undefined) => void) | null =
      null;
    const flakyStorage: StateStorage = {
      getItem: () => null,
      setItem: (_name, value) => {
        if (failNext) {
          failNext = false;
          throw new Error("first flush fails");
        }
        writes.push(
          (JSON.parse(value) as { state: { count: number } }).state.count,
        );
      },
      removeItem: () => {},
    };

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "throttle-retry-generation",
      storage: createJSONStorage<{ count: number }>(() => flakyStorage)!,
      throttleMs: 10,
      retryWrite: () =>
        new Promise<{ count: number } | undefined>((resolve) => {
          releaseRetry = resolve;
        }),
    });
    await waitForHydration(persist.hasHydrated);

    source.setState(() => ({ count: 1 }));
    // First flush fails; the retryWrite promise is now pending.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(releaseRetry).not.toBeNull();

    // Newer state coalesces — schedule-time generation bump supersedes the
    // in-flight retry loop BEFORE its result lands.
    source.setState(() => ({ count: 2 }));
    releaseRetry!({ count: 1 }); // stale shrunk state — must be discarded
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Only the newer flush wrote; the stale retry result never landed.
    expect(writes).toEqual([2]);

    persist.destroy();
  });
});

describe("persistSource retryWrite", () => {
  let memory: MemoryStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  it("quota-throw → shrink → success: storage ends with the shrunk state, no onError", async () => {
    // Backend rejects payloads over a size threshold — a quota simulation.
    const quotaStorage: StateStorage = {
      getItem: (key) => memory.getItem(key),
      setItem: (key, value) => {
        if (value.length > 120) throw new Error("quota exceeded");
        memory.setItem(key, value);
      },
      removeItem: (key) => memory.removeItem(key),
    };
    const jsonStorage = createJSONStorage<{ history: string[] }>(
      () => quotaStorage,
    )!;

    const errors: unknown[] = [];
    const retryCalls: number[] = [];
    const source = createMockSource({ history: [] as string[] });
    const persist = persistSource(source, {
      name: "shrink",
      storage: jsonStorage,
      onError: (error) => errors.push(error),
      retryWrite: ({ state, errorCount }) => {
        retryCalls.push(errorCount);
        // Drop the heaviest field — errorCount as the aggressiveness dial.
        return { ...state, history: state.history.slice(-1) };
      },
    });
    await waitForHydration(persist.hasHydrated);

    source.setState(() => ({
      history: Array.from({ length: 20 }, (_, i) => `entry-${i}`),
    }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(retryCalls).toEqual([1]);
    expect(errors).toEqual([]);
    const stored = await jsonStorage.getItem("shrink");
    expect(stored?.state.history).toEqual(["entry-19"]);
  });

  it("give-up reports the LAST error exactly once", async () => {
    let attempt = 0;
    const alwaysFailStorage: StateStorage = {
      getItem: () => null,
      setItem: () => {
        attempt++;
        throw new Error(`fail-${attempt}`);
      },
      removeItem: () => {},
    };
    const errors: string[] = [];
    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "give-up",
      storage: createJSONStorage<{ count: number }>(() => alwaysFailStorage)!,
      onError: (error) => errors.push((error as Error).message),
      // Two shrink attempts, then surrender.
      retryWrite: ({ state, errorCount }) =>
        errorCount <= 2 ? state : undefined,
    });
    await waitForHydration(persist.hasHydrated);

    source.setState(() => ({ count: 1 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Initial attempt + 2 retries all failed; only the LAST error surfaces.
    expect(attempt).toBe(3);
    expect(errors).toEqual(["fail-3"]);
  });

  it("generation-abandonment: a newer setState write supersedes a pending async retry — result discarded silently", async () => {
    // setItem fails only for count:1 payloads; anything else lands.
    const written: string[] = [];
    const selectiveStorage: StateStorage = {
      getItem: () => null,
      setItem: (_key, value) => {
        if (value.includes('"count":1')) throw new Error("quota");
        written.push(value);
      },
      removeItem: () => {},
    };
    let resolveRetry: ((state: { count: number }) => void) | undefined;
    const errors: unknown[] = [];
    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "supersede",
      storage: createJSONStorage<{ count: number }>(() => selectiveStorage)!,
      onError: (error) => errors.push(error),
      retryWrite: () =>
        new Promise<{ count: number }>((resolve) => {
          resolveRetry = resolve;
        }),
    });
    await waitForHydration(persist.hasHydrated);

    // count:1 fails → retryWrite pending. Meanwhile a newer setState (count:2)
    // starts a new write generation and succeeds.
    source.setState(() => ({ count: 1 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    source.setState(() => ({ count: 2 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The stale retry resolves AFTER the newer write — must be discarded.
    resolveRetry?.({ count: 99 });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(errors).toEqual([]); // abandoned silently, no report
    expect(written.length).toBe(1);
    expect(written[0]).toContain('"count":2'); // newer state won; 99 never written
  });

  it("destroy() abandons a pending retry loop silently", async () => {
    const written: string[] = [];
    const failOnceStorage: StateStorage = {
      getItem: () => null,
      setItem: (_key, value) => {
        if (written.length === 0 && value.includes('"count":1')) {
          throw new Error("quota");
        }
        written.push(value);
      },
      removeItem: () => {},
    };
    let resolveRetry: ((state: { count: number }) => void) | undefined;
    const errors: unknown[] = [];
    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "retry-destroy",
      storage: createJSONStorage<{ count: number }>(() => failOnceStorage)!,
      onError: (error) => errors.push(error),
      retryWrite: () =>
        new Promise<{ count: number }>((resolve) => {
          resolveRetry = resolve;
        }),
    });
    await waitForHydration(persist.hasHydrated);

    source.setState(() => ({ count: 1 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    persist.destroy();
    resolveRetry?.({ count: 99 });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(written).toEqual([]); // nothing committed after teardown
    expect(errors).toEqual([]);
  });

  it("the post-migrate write-back is retried too", async () => {
    let failNext = true;
    const flakyStorage: StateStorage = {
      getItem: (key) => memory.getItem(key),
      setItem: (key, value) => {
        if (failNext) {
          failNext = false;
          throw new Error("transient quota");
        }
        memory.setItem(key, value);
      },
      removeItem: (key) => memory.removeItem(key),
    };
    const jsonStorage = createJSONStorage<{ value: string }>(
      () => flakyStorage,
    )!;
    failNext = false;
    await jsonStorage.setItem("retry-migrate", {
      state: { value: "old" },
      version: 0,
    });
    failNext = true;

    const errors: unknown[] = [];
    const retryCalls: number[] = [];
    const source = createMockSource({ value: "initial" });
    const persist = persistSource(source, {
      name: "retry-migrate",
      storage: jsonStorage,
      version: 1,
      migrate: (persisted) => ({
        value: `${(persisted as { value: string }).value}-migrated`,
      }),
      onError: (error) => errors.push(error),
      retryWrite: ({ state, errorCount }) => {
        retryCalls.push(errorCount);
        return state;
      },
    });

    await waitForHydration(persist.hasHydrated);
    expect(retryCalls).toEqual([1]);
    expect(errors).toEqual([]);
    const stored = await jsonStorage.getItem("retry-migrate");
    expect(stored?.version).toBe(1);
    expect(stored?.state.value).toBe("old-migrated");
  });

  it("sync-path purity: retryWrite unset → a sync setItem throw is reported synchronously (no promise hop)", async () => {
    const throwingStorage: StateStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
      removeItem: () => {},
    };
    const errors: string[] = [];
    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "sync-pure",
      storage: createJSONStorage<{ count: number }>(() => throwingStorage)!,
      onError: (error) => errors.push((error as Error).message),
    });
    await waitForHydration(persist.hasHydrated);

    source.setState(() => ({ count: 1 }));
    // Asserted BEFORE any await: the no-retry path stays fully synchronous.
    expect(errors).toEqual(["quota exceeded"]);
  });

  it("retry attempts rebuild the envelope fresh (new timestamp, current buster)", async () => {
    let failNext = true;
    const flakyStorage: StateStorage = {
      getItem: () => null,
      setItem: (key, value) => {
        if (failNext) {
          failNext = false;
          throw new Error("transient");
        }
        memory.setItem(key, value);
      },
      removeItem: () => {},
    };
    const jsonStorage = createJSONStorage<{ count: number }>(
      () => flakyStorage,
    )!;

    const before = Date.now();
    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "fresh-envelope",
      storage: jsonStorage,
      buster: "v1",
      retryWrite: ({ state }) => state,
    });
    await waitForHydration(persist.hasHydrated);

    source.setState(() => ({ count: 3 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const raw = memory.getItem("fresh-envelope");
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!) as {
      state: { count: number };
      timestamp: number;
      buster: string;
    };
    expect(stored.state.count).toBe(3);
    expect(stored.buster).toBe("v1");
    expect(stored.timestamp).toBeGreaterThanOrEqual(before);
  });
});

describe("persistApi.setOptions", () => {
  let memory: MemoryStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  afterEach(() => {
    memory.clear();
  });

  it("merge: undefined does not clobber the default shallow-spread merge", async () => {
    const jsonStorage = createJSONStorage<{
      count: number;
      extra: string;
    }>(() => memory)!;
    await jsonStorage.setItem("setopts", {
      state: { count: 42, extra: "persisted" },
      version: 0,
    });

    const source = createMockSource({ count: 0, extra: "initial" });
    const persist = persistSource(source, {
      name: "setopts",
      storage: jsonStorage,
      skipHydration: true,
    });

    // Explicit `undefined` must NOT wipe the default merge — the spread fallback
    // still runs and hydrates the persisted slice over the current state.
    persist.setOptions({ merge: undefined });
    await persist.rehydrate();

    expect(persist.hasHydrated()).toBe(true);
    expect(source.state.count).toBe(42);
    expect(source.state.extra).toBe("persisted");
  });

  it("merge: custom merge passed to setOptions is applied", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    await jsonStorage.setItem("setopts-custom", {
      state: { count: 42 },
      version: 0,
    });

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "setopts-custom",
      storage: jsonStorage,
      skipHydration: true,
    });

    persist.setOptions({
      merge: () => ({ count: 999 }),
    });
    await persist.rehydrate();

    expect(source.state.count).toBe(999);
  });
});

describe("PersistRegistry", () => {
  let memory: MemoryStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  afterEach(() => {
    memory.clear();
  });

  it("clearAll clears registered persisted stores on logout", async () => {
    const source = createMockSource({ flag: false });
    const jsonStorage = createJSONStorage<{ flag: boolean }>(() => memory)!;
    const registry = createPersistRegistry();

    const persist = persistSource(source, {
      name: "logout-store",
      storage: jsonStorage,
      registry,
    });

    await waitForHydration(persist.hasHydrated);
    source.setState(() => ({ flag: true }));
    await new Promise((resolve) => queueMicrotask(resolve));
    expect(await jsonStorage.getItem("logout-store")).not.toBeNull();

    await registry.clearAll();
    expect(await jsonStorage.getItem("logout-store")).toBeNull();
  });

  it("unregister removes a store from clearAll", async () => {
    const jsonStorage = createJSONStorage<{ value: number }>(() => memory)!;
    await jsonStorage.setItem("manual", { state: { value: 1 }, version: 0 });
    const registry = createPersistRegistry();

    const unregister = registry.register(() =>
      jsonStorage.removeItem("manual"),
    );

    unregister();
    await registry.clearAll();
    expect(await jsonStorage.getItem("manual")).not.toBeNull();
  });

  it("clearAll rethrows the first rejection after attempting every clear", async () => {
    const registry = createPersistRegistry();
    const calls: string[] = [];
    registry.register(() => {
      calls.push("a");
      throw new Error("a boom");
    });
    registry.register(
      () =>
        new Promise<void>((resolve) => {
          calls.push("b");
          resolve();
        }),
    );
    registry.register(() => {
      calls.push("c");
      throw new Error("c boom");
    });

    await expect(registry.clearAll()).rejects.toThrow(/boom/);
    // every clear ran despite the rejections
    expect(calls.sort()).toEqual(["a", "b", "c"]);
  });

  it("persistSource without a registry never registers (no ambient state)", async () => {
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    const registry = createPersistRegistry();
    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "no-registry",
      storage: jsonStorage,
    });

    await waitForHydration(persist.hasHydrated);
    source.setState((prev) => ({ ...prev, count: 1 }));
    await new Promise((resolve) => queueMicrotask(resolve));
    expect(await jsonStorage.getItem("no-registry")).not.toBeNull();

    // An unrelated registry clearAll must not touch the unregistered store.
    await registry.clearAll();
    expect(await jsonStorage.getItem("no-registry")).not.toBeNull();
  });
});

describe("createMigrationChain", () => {
  it("walks every step from the stored version to the current one", async () => {
    const migrate = createMigrationChain<{
      count?: number;
      theme?: string;
      filters?: string[];
      layout?: string;
    }>({
      version: 3,
      steps: {
        0: (s) => ({ ...s, theme: "light" }),
        1: (s) => ({ ...s, filters: [] }),
        2: (s) => ({ ...s, layout: "grid" }),
      },
    });
    // v0 payload → runs all three steps in order.
    expect(await migrate({ count: 7 }, 0)).toEqual({
      count: 7,
      theme: "light",
      filters: [],
      layout: "grid",
    });
  });

  it("runs only the steps from the stored version onward (partial walk)", async () => {
    const migrate = createMigrationChain<{
      count?: number;
      theme?: string;
      filters?: string[];
      layout?: string;
    }>({
      version: 3,
      steps: {
        0: (s) => ({ ...s, theme: "light" }),
        1: (s) => ({ ...s, filters: [] }),
        2: (s) => ({ ...s, layout: "grid" }),
      },
    });
    // v2 payload → only steps[2] runs.
    expect(
      await migrate({ count: 7, theme: "dark", filters: ["x"] }, 2),
    ).toEqual({ count: 7, theme: "dark", filters: ["x"], layout: "grid" });
  });

  it("awaits async steps sequentially", async () => {
    const order: number[] = [];
    const migrate = createMigrationChain<{ v?: number }>({
      version: 3,
      steps: {
        0: async (s) => {
          await new Promise((r) => setTimeout(r, 5));
          order.push(0);
          return { ...s, v: 1 };
        },
        1: async (s) => {
          order.push(1);
          return { ...s, v: 2 };
        },
        2: async (s) => {
          order.push(2);
          return { ...s, v: 3 };
        },
      },
    });
    await migrate({}, 0);
    expect(order).toEqual([0, 1, 2]);
  });

  it("discards (returns undefined) when the stored version is older than the chain's earliest step", async () => {
    const migrate = createMigrationChain<{ x?: number }>({
      version: 3,
      steps: { 2: (s) => ({ ...s, x: 1 }) }, // minKey=2 → v0/v1 unsupported
    });
    expect(await migrate({ count: 7 }, 0)).toBeUndefined();
  });

  it("onOlder: 'throw' → migrate throws", async () => {
    const migrate = createMigrationChain<{ x?: number }>({
      version: 3,
      steps: { 2: (s) => ({ ...s, x: 1 }) },
      onOlder: "throw",
    });
    await expect(migrate({}, 0)).rejects.toThrow(
      /older than the chain's earliest/,
    );
  });

  it("onNewer: default 'throw' when the stored version is newer than current", async () => {
    const migrate = createMigrationChain<{ x?: number }>({
      version: 3,
      steps: { 0: (s) => s, 1: (s) => s, 2: (s) => s },
    });
    await expect(migrate({}, 5)).rejects.toThrow(/newer than current 3/);
  });

  it("onNewer: 'discard' → returns undefined", async () => {
    const migrate = createMigrationChain<{ x?: number }>({
      version: 3,
      steps: { 0: (s) => s, 1: (s) => s, 2: (s) => s },
      onNewer: "discard",
    });
    expect(await migrate({}, 5)).toBeUndefined();
  });

  it("propagates a throwing step", async () => {
    const migrate = createMigrationChain<{ x?: number }>({
      version: 2,
      steps: {
        0: (s) => s,
        1: () => {
          throw new Error("bad step");
        },
      },
    });
    await expect(migrate({}, 0)).rejects.toThrow("bad step");
  });

  it("eagerly throws at construction on a gap in the covered range", () => {
    expect(() =>
      createMigrationChain<{ x?: number }>({
        version: 3,
        steps: { 0: (s) => s, 2: (s) => s }, // missing 1
      }),
    ).toThrow(/missing migration step from v1/);
  });

  it("eagerly throws at construction on an out-of-range step key", () => {
    expect(() =>
      createMigrationChain<{ x?: number }>({
        version: 3,
        steps: { 0: (s) => s, 1: (s) => s, 2: (s) => s, 3: (s) => s }, // 3 >= version
      }),
    ).toThrow(/out of range/);
  });

  it("eagerly throws at construction on a non-integer / negative version", () => {
    expect(() => createMigrationChain({ version: 2.5, steps: {} })).toThrow(
      /non-negative integer/,
    );
    expect(() => createMigrationChain({ version: -1, steps: {} })).toThrow(
      /non-negative integer/,
    );
  });

  it("end-to-end: a v0 payload hydrates through the chain to the current version", async () => {
    const memory = new MemoryStorage();
    const jsonStorage = createJSONStorage<{
      theme?: string;
      filters?: string[];
    }>(() => memory)!;
    await jsonStorage.setItem("prefs", {
      state: { theme: "dark" },
      version: 0,
    });

    const source = createMockSource({ theme: "light", filters: ["default"] });
    const persist = persistSource(source, {
      name: "prefs",
      version: 2,
      storage: jsonStorage,
      migrate: createMigrationChain<{ theme?: string; filters?: string[] }>({
        version: 2,
        steps: {
          0: (s) => ({ ...s, theme: "light" }),
          1: (s) => ({ ...s, filters: [] }),
        },
      }),
    });
    await waitForHydration(persist.hasHydrated);
    expect(source.state).toEqual({ theme: "light", filters: [] });
    // The migrated state writes back at the current version.
    expect((await jsonStorage.getItem("prefs"))?.version).toBe(2);
  });

  it("end-to-end: onOlder discard keeps the initial state (no onError)", async () => {
    const memory = new MemoryStorage();
    const jsonStorage = createJSONStorage<{ x?: number }>(() => memory)!;
    await jsonStorage.setItem("dropped", { state: { x: 7 }, version: 0 });

    const errors: Array<{ phase: string }> = [];
    const source = createMockSource({ x: 99 });
    const persist = persistSource(source, {
      name: "dropped",
      version: 3,
      storage: jsonStorage,
      migrate: createMigrationChain<{ x?: number }>({
        version: 3,
        steps: { 2: (s) => s }, // minKey=2 → v0 unsupported
      }),
      onError: (_e, ctx) => errors.push({ phase: ctx.phase }),
    });
    await waitForHydration(persist.hasHydrated);
    // Discarded → keeps initial state, no error reported.
    expect(source.state).toEqual({ x: 99 });
    expect(errors).toEqual([]);
  });

  it("end-to-end: a throwing step routes to onError phase 'migrate'", async () => {
    const memory = new MemoryStorage();
    const jsonStorage = createJSONStorage<{ x?: number }>(() => memory)!;
    await jsonStorage.setItem("bad-step", { state: { x: 1 }, version: 0 });

    const errors: Array<{ phase: string; message: string }> = [];
    const source = createMockSource({ x: 0 });
    const persist = persistSource(source, {
      name: "bad-step",
      version: 2,
      storage: jsonStorage,
      migrate: createMigrationChain<{ x?: number }>({
        version: 2,
        steps: {
          0: (s) => s,
          1: () => {
            throw new Error("bad step");
          },
        },
      }),
      onError: (e, ctx) =>
        errors.push({ phase: ctx.phase, message: (e as Error).message }),
    });
    await waitForHydration(persist.hasHydrated);
    expect(errors).toContainEqual({ phase: "migrate", message: "bad step" });
  });
});
