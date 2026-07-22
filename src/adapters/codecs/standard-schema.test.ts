import { beforeEach, describe, expect, it } from "bun:test";

import { z } from "zod";

import {
  createStorage,
  jsonCodec,
  persistSource,
} from "../../core/persist-core";
import type { PersistStorage, StorageValue } from "../../core/persist-core";
import { itImportsOnlyFromCore } from "../../testing/assert-core-only-imports";
import { MemoryStorage } from "../../testing/memory-storage";
import { createMockSource } from "../../testing/mock-source";
import { waitForHydration } from "../../testing/wait-for-hydration";
import type { StandardSchemaV1 } from "./standard-schema";
import {
  createStandardSchemaStorage,
  createStandardSchemaStorageAsync,
  standardSchemaCodec,
  withStandardSchema,
  withStandardSchemaAsync,
} from "./standard-schema";

function fakeSchema<Output>(opts: {
  validate: (
    input: unknown,
  ) =>
    | StandardSchemaV1.Result<Output>
    | Promise<StandardSchemaV1.Result<Output>>;
}): StandardSchemaV1<unknown, Output> {
  return {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: opts.validate,
    },
  };
}

describe("standardSchemaCodec", () => {
  let memory: MemoryStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  it("round-trips typed state through a sync StandardSchemaV1", async () => {
    const schema = fakeSchema<{ count: number }>({
      validate: (input) => {
        const value = input as { count: number };
        if (typeof value?.count !== "number") {
          return { issues: [{ message: "count must be a number" }] };
        }
        return { value };
      },
    });
    const storage = createStandardSchemaStorage<{ count: number }>(
      () => memory,
      schema,
    )!;

    await storage.setItem("test", {
      state: { count: 42 },
      version: 1,
    });

    const stored = await storage.getItem("test");
    expect(stored?.state.count).toBe(42);
    expect(stored?.version).toBe(1);
  });

  it("decode of an invalid payload returns null", async () => {
    memory.setItem("bad", JSON.stringify({ state: { count: "not-a-number" } }));

    const schema = fakeSchema<{ count: number }>({
      validate: (input) => {
        const value = input as { count: number };
        if (typeof value?.count !== "number") {
          return { issues: [{ message: "count must be a number" }] };
        }
        return { value };
      },
    });
    const storage = createStandardSchemaStorage<{ count: number }>(
      () => memory,
      schema,
    )!;
    expect(await storage.getItem("bad")).toBeNull();
  });

  it("clearCorruptOnFailure removes the key on an invalid payload", async () => {
    memory.setItem("corrupt", JSON.stringify({ state: { count: "bad" } }));

    const schema = fakeSchema<{ count: number }>({
      validate: (input) => {
        const value = input as { count: number };
        if (typeof value?.count !== "number") {
          return { issues: [{ message: "count must be a number" }] };
        }
        return { value };
      },
    });
    const storage = createStandardSchemaStorage<{ count: number }>(
      () => memory,
      schema,
      { clearCorruptOnFailure: true },
    )!;

    expect(await storage.getItem("corrupt")).toBeNull();
    expect(memory.getItem("corrupt")).toBeNull();
  });

  it("encode of an invalid state throws and abandons the write", async () => {
    const schema = fakeSchema<{ count: number }>({
      validate: (input) => {
        const value = input as { count: number };
        if (typeof value?.count !== "number") {
          return { issues: [{ message: "count must be a number" }] };
        }
        return { value };
      },
    });
    const errors: Array<{ phase: string }> = [];
    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "invalid-write",
      storage: createStandardSchemaStorage<{ count: number }>(
        () => memory,
        schema,
      )!,
      onError: (_error, context) => errors.push({ phase: context.phase }),
    });

    await waitForHydration(persist.hasHydrated);

    source.setState(
      () => ({ count: "not-a-number" }) as unknown as { count: number },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(memory.getItem("invalid-write")).toBeNull();
    expect(errors.some((entry) => entry.phase === "write")).toBe(true);

    persist.destroy();
  });

  it("async validate throws Persist message on encode and decode", async () => {
    const schema = fakeSchema<{ count: number }>({
      validate: async (input) => ({ value: input as { count: number } }),
    });
    const codec = standardSchemaCodec(schema);
    const asyncMessage =
      "[@stainless-code/persist] Async Standard Schema validation is not supported — use withStandardSchemaAsync.";

    expect(() => codec.encode({ state: { count: 1 }, version: 0 })).toThrow(
      asyncMessage,
    );

    expect(() =>
      codec.decode(JSON.stringify({ state: { count: 1 }, version: 0 })),
    ).toThrow(asyncMessage);
  });

  it("rejecting async validate does not surface unhandledRejection", async () => {
    const schema = fakeSchema<{ count: number }>({
      validate: () => Promise.reject(new Error("schema boom")),
    });
    const codec = standardSchemaCodec(schema);
    const asyncMessage =
      "[@stainless-code/persist] Async Standard Schema validation is not supported — use withStandardSchemaAsync.";

    expect(() => codec.encode({ state: { count: 1 }, version: 0 })).toThrow(
      asyncMessage,
    );

    // Flush microtasks — a missing .catch would fire unhandledRejection.
    await Promise.resolve();
  });

  it("encode persists transformed output from validate", async () => {
    const schema = fakeSchema<{ count: number; label: string }>({
      validate: (input) => {
        const value = input as { count: number; label?: string };
        if (typeof value?.count !== "number") {
          return { issues: [{ message: "count must be a number" }] };
        }
        return {
          value: { count: value.count, label: value.label ?? "default" },
        };
      },
    });
    const storage = createStandardSchemaStorage<{
      count: number;
      label: string;
    }>(() => memory, schema)!;

    await storage.setItem("transformed", {
      state: { count: 3 } as { count: number; label: string },
      version: 0,
    });

    const raw = memory.getItem("transformed");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as {
      state: { count: number; label: string };
    };
    expect(parsed.state).toEqual({ count: 3, label: "default" });

    const stored = await storage.getItem("transformed");
    expect(stored?.state).toEqual({ count: 3, label: "default" });
  });

  it("works with a real zod schema via ~standard", async () => {
    const schema = z.object({ count: z.number() });
    expect(schema["~standard"]?.version).toBe(1);

    const storage = createStandardSchemaStorage<{ count: number }>(
      () => memory,
      schema,
    )!;

    await storage.setItem("zod-interop", {
      state: { count: 9 },
      version: 0,
    });
    const stored = await storage.getItem("zod-interop");
    expect(stored?.state.count).toBe(9);
  });
});

describe("withStandardSchema", () => {
  function memoryPersistStorage<S>(): PersistStorage<S> & {
    store: Map<string, StorageValue<S>>;
  } {
    const store = new Map<string, StorageValue<S>>();
    return {
      store,
      getItem(name) {
        return store.get(name) ?? null;
      },
      setItem(name, value) {
        store.set(name, value);
      },
      removeItem(name) {
        store.delete(name);
      },
      raw: store,
    };
  }

  function countSchema() {
    return fakeSchema<{ count: number }>({
      validate: (input) => {
        const value = input as { count: number };
        if (typeof value?.count !== "number") {
          return { issues: [{ message: "count must be a number" }] };
        }
        return { value };
      },
    });
  }

  it("round-trips typed state over a hand-rolled PersistStorage", () => {
    const inner = memoryPersistStorage<{ count: number }>();
    const storage = withStandardSchema(inner, countSchema());

    storage.setItem("test", { state: { count: 42 }, version: 1 });
    const stored = storage.getItem("test");
    expect(stored).toEqual({ state: { count: 42 }, version: 1 });
    expect(inner.store.get("test")?.state.count).toBe(42);
  });

  it("invalid get returns null and clearCorruptOnFailure removes the key", () => {
    const inner = memoryPersistStorage<{ count: number }>();
    inner.store.set("corrupt", {
      state: { count: "bad" } as unknown as { count: number },
      version: 0,
    });

    const storage = withStandardSchema(inner, countSchema(), {
      clearCorruptOnFailure: true,
    });

    expect(storage.getItem("corrupt")).toBeNull();
    expect(inner.store.has("corrupt")).toBe(false);
  });

  it("Promise-returning inner getItem still validates sync schema", async () => {
    const store = new Map<string, StorageValue<{ count: number }>>();
    store.set("async-backend", {
      state: { count: 7 },
      version: 0,
    });
    store.set("async-bad", {
      state: { count: "nope" } as unknown as { count: number },
      version: 0,
    });

    const inner: PersistStorage<{ count: number }> = {
      getItem(name) {
        return Promise.resolve(store.get(name) ?? null);
      },
      setItem(name, value) {
        store.set(name, value);
      },
      removeItem(name) {
        store.delete(name);
      },
    };

    const storage = withStandardSchema(inner, countSchema(), {
      clearCorruptOnFailure: true,
    });

    await expect(storage.getItem("async-backend")).resolves.toEqual({
      state: { count: 7 },
      version: 0,
    });
    await expect(storage.getItem("async-bad")).resolves.toBeNull();
    expect(store.has("async-bad")).toBe(false);
  });

  it("async schema throws Persist async message", () => {
    const inner = memoryPersistStorage<{ count: number }>();
    const schema = fakeSchema<{ count: number }>({
      validate: async (input) => ({ value: input as { count: number } }),
    });
    const storage = withStandardSchema(inner, schema);
    const asyncMessage =
      "[@stainless-code/persist] Async Standard Schema validation is not supported — use withStandardSchemaAsync.";

    expect(() =>
      storage.setItem("async-schema", { state: { count: 1 }, version: 0 }),
    ).toThrow(asyncMessage);
  });

  it("async schema on get throws and does not clearCorrupt", () => {
    const inner = memoryPersistStorage<{ count: number }>();
    inner.store.set("keep", { state: { count: 1 }, version: 0 });
    const schema = fakeSchema<{ count: number }>({
      validate: async (input) => ({ value: input as { count: number } }),
    });
    const storage = withStandardSchema(inner, schema, {
      clearCorruptOnFailure: true,
    });
    const asyncMessage =
      "[@stainless-code/persist] Async Standard Schema validation is not supported — use withStandardSchemaAsync.";

    expect(() => storage.getItem("keep")).toThrow(asyncMessage);
    expect(inner.store.has("keep")).toBe(true);
  });

  it("Promise getItem + async schema throws and does not clearCorrupt", async () => {
    const store = new Map<string, StorageValue<{ count: number }>>();
    store.set("keep", { state: { count: 1 }, version: 0 });
    const inner: PersistStorage<{ count: number }> = {
      getItem(name) {
        return Promise.resolve(store.get(name) ?? null);
      },
      setItem(name, value) {
        store.set(name, value);
      },
      removeItem(name) {
        store.delete(name);
      },
    };
    const schema = fakeSchema<{ count: number }>({
      validate: async (input) => ({ value: input as { count: number } }),
    });
    const storage = withStandardSchema(inner, schema, {
      clearCorruptOnFailure: true,
    });
    const asyncMessage =
      "[@stainless-code/persist] Async Standard Schema validation is not supported — use withStandardSchemaAsync.";

    await expect(storage.getItem("keep")).rejects.toThrow(asyncMessage);
    expect(store.has("keep")).toBe(true);
  });

  it("composes over createStorage + jsonCodec (non-codec-coupled path)", async () => {
    const memory = new MemoryStorage();
    const inner = createStorage<{ count: number }>(
      () => memory,
      jsonCodec<{ count: number }>(),
    )!;
    const storage = withStandardSchema(inner, countSchema());

    await storage.setItem("compose", { state: { count: 11 }, version: 0 });
    const stored = await storage.getItem("compose");
    expect(stored).toEqual({ state: { count: 11 }, version: 0 });
  });
});

describe("withStandardSchemaAsync", () => {
  function memoryPersistStorage<S>(): PersistStorage<S> & {
    store: Map<string, StorageValue<S>>;
  } {
    const store = new Map<string, StorageValue<S>>();
    return {
      store,
      getItem(name) {
        return store.get(name) ?? null;
      },
      setItem(name, value) {
        store.set(name, value);
      },
      removeItem(name) {
        store.delete(name);
      },
      raw: store,
    };
  }

  function asyncCountSchema() {
    return fakeSchema<{ count: number }>({
      validate: async (input) => {
        const value = input as { count: number };
        if (typeof value?.count !== "number") {
          return { issues: [{ message: "count must be a number" }] };
        }
        return { value };
      },
    });
  }

  function syncCountSchema() {
    return fakeSchema<{ count: number }>({
      validate: (input) => {
        const value = input as { count: number };
        if (typeof value?.count !== "number") {
          return { issues: [{ message: "count must be a number" }] };
        }
        return { value };
      },
    });
  }

  it("round-trips typed state via async schema over hand-rolled PersistStorage", async () => {
    const inner = memoryPersistStorage<{ count: number }>();
    const storage = withStandardSchemaAsync(inner, asyncCountSchema());

    await storage.setItem("test", { state: { count: 42 }, version: 1 });
    const stored = await storage.getItem("test");
    expect(stored).toEqual({ state: { count: 42 }, version: 1 });
    expect(inner.store.get("test")?.state.count).toBe(42);
    expect(storage.raw).toBe(inner.raw);
  });

  it("sync schema works through withStandardSchemaAsync", async () => {
    const inner = memoryPersistStorage<{ count: number }>();
    const storage = withStandardSchemaAsync(inner, syncCountSchema());

    await storage.setItem("sync", { state: { count: 5 }, version: 0 });
    await expect(storage.getItem("sync")).resolves.toEqual({
      state: { count: 5 },
      version: 0,
    });
  });

  it("invalid get returns null and clearCorruptOnFailure removes the key", async () => {
    const inner = memoryPersistStorage<{ count: number }>();
    inner.store.set("corrupt", {
      state: { count: "bad" } as unknown as { count: number },
      version: 0,
    });

    const storage = withStandardSchemaAsync(inner, asyncCountSchema(), {
      clearCorruptOnFailure: true,
    });

    await expect(storage.getItem("corrupt")).resolves.toBeNull();
    expect(inner.store.has("corrupt")).toBe(false);
  });

  it("rejecting validate does not leave unhandledRejection", async () => {
    const inner = memoryPersistStorage<{ count: number }>();
    const schema = fakeSchema<{ count: number }>({
      validate: () => Promise.reject(new Error("schema boom")),
    });
    const storage = withStandardSchemaAsync(inner, schema);

    await expect(
      storage.setItem("boom", { state: { count: 1 }, version: 0 }),
    ).rejects.toThrow("schema boom");

    inner.store.set("boom-get", { state: { count: 1 }, version: 0 });
    // Rejecting get validate is contained — returns null, no unhandledRejection.
    await expect(storage.getItem("boom-get")).resolves.toBeNull();
    await Promise.resolve();
  });
});

describe("createStandardSchemaStorage", () => {
  it("wrong-lane async schema on get throws and does not clearCorrupt", async () => {
    const memory = new MemoryStorage();
    memory.setItem("keep", JSON.stringify({ state: { count: 1 }, version: 0 }));
    const schema = fakeSchema<{ count: number }>({
      validate: async (input) => ({ value: input as { count: number } }),
    });
    const storage = createStandardSchemaStorage<{ count: number }>(
      () => memory,
      schema,
      { clearCorruptOnFailure: true },
    )!;
    const asyncMessage =
      "[@stainless-code/persist] Async Standard Schema validation is not supported — use withStandardSchemaAsync.";

    // Sync JSON backend → sync throw (not a rejected Promise).
    expect(() => storage.getItem("keep")).toThrow(asyncMessage);
    expect(memory.getItem("keep")).not.toBeNull();
  });
});

describe("createStandardSchemaStorageAsync", () => {
  it("round-trips via fake async schema over MemoryStorage", async () => {
    const memory = new MemoryStorage();
    const schema = fakeSchema<{ count: number }>({
      validate: async (input) => {
        const value = input as { count: number };
        if (typeof value?.count !== "number") {
          return { issues: [{ message: "count must be a number" }] };
        }
        return { value };
      },
    });
    const storage = createStandardSchemaStorageAsync<{ count: number }>(
      () => memory,
      schema,
    )!;

    await storage.setItem("async-sugar", {
      state: { count: 8 },
      version: 0,
    });
    const stored = await storage.getItem("async-sugar");
    expect(stored?.state.count).toBe(8);
  });

  it("invalid get returns null and clearCorruptOnFailure removes the key", async () => {
    const memory = new MemoryStorage();
    memory.setItem(
      "corrupt",
      JSON.stringify({ state: { count: "bad" }, version: 0 }),
    );
    const schema = fakeSchema<{ count: number }>({
      validate: async (input) => {
        const value = input as { count: number };
        if (typeof value?.count !== "number") {
          return { issues: [{ message: "count must be a number" }] };
        }
        return { value };
      },
    });
    const storage = createStandardSchemaStorageAsync<{ count: number }>(
      () => memory,
      schema,
      { clearCorruptOnFailure: true },
    )!;

    await expect(storage.getItem("corrupt")).resolves.toBeNull();
    expect(memory.getItem("corrupt")).toBeNull();
  });
});

describe("standardSchemaCodec direct seam", () => {
  let memory: MemoryStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  it("standardSchemaCodec plugs into createStorage directly", async () => {
    const schema = fakeSchema<{ count: number }>({
      validate: (input) => {
        const value = input as { count: number };
        if (typeof value?.count !== "number") {
          return { issues: [{ message: "count must be a number" }] };
        }
        return { value };
      },
    });
    const storage = createStorage<{ count: number }>(
      () => memory,
      standardSchemaCodec(schema),
    )!;

    await storage.setItem("direct-standard-schema", {
      state: { count: 7 },
      version: 0,
    });
    const stored = await storage.getItem("direct-standard-schema");
    expect(stored?.state.count).toBe(7);
  });

  it("async schema + clearCorruptOnFailure throws and does not clear the key", () => {
    memory.setItem("keep", JSON.stringify({ state: { count: 1 }, version: 0 }));
    const schema = fakeSchema<{ count: number }>({
      validate: async (input) => ({ value: input as { count: number } }),
    });
    const storage = createStorage<{ count: number }>(
      () => memory,
      standardSchemaCodec(schema),
      { clearCorruptOnFailure: true },
    )!;
    const asyncMessage =
      "[@stainless-code/persist] Async Standard Schema validation is not supported — use withStandardSchemaAsync.";

    expect(() => storage.getItem("keep")).toThrow(asyncMessage);
    expect(memory.getItem("keep")).not.toBeNull();
  });
});

describe("standard-schema dependency isolation", () => {
  itImportsOnlyFromCore(new URL("./standard-schema.ts", import.meta.url));
});
