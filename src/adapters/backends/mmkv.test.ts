import { beforeEach, describe, expect, it, mock } from "bun:test";

import type { MMKV } from "react-native-mmkv";

import { createMockSource } from "../../testing/mock-source";
import { waitForHydration } from "../../testing/wait-for-hydration";

// Fake MMKV instance backed by a Map; createMMKV returns one per id. Cast to
// `MMKV` — the adapter only calls `getString`/`set`/`remove`; the HybridObject
// base props (`name`/`equals`/`dispose`/…) are unused in tests.
const instances = new Map<string, Map<string, string>>();
function fakeInstance(id: string): MMKV {
  let map = instances.get(id);
  if (!map) {
    map = new Map();
    instances.set(id, map);
  }
  return {
    id,
    set: (key: string, value: boolean | string | number | ArrayBuffer) => {
      map!.set(key, String(value));
    },
    getString: (key: string) => map!.get(key) as string | undefined,
    remove: (key: string) => map!.delete(key),
    contains: (key: string) => map!.has(key),
    getAllKeys: () => [...map!.keys()],
    clearAll: () => map!.clear(),
  } as unknown as MMKV;
}

mock.module("react-native-mmkv", () => ({
  createMMKV: (config: { id: string }) => fakeInstance(config.id),
}));

const { mmkvStateStorage, createMmkvStorage } = await import("./mmkv");
const { persistSource } = await import("../../core/persist-core");

describe("createMmkvStorage", () => {
  beforeEach(() => instances.clear());

  it("mmkvStateStorage round-trips synchronously", () => {
    const instance = fakeInstance("state");
    const storage = mmkvStateStorage(instance);

    expect(storage.getItem("missing")).toBeNull();

    storage.setItem("k", "v");
    expect(storage.getItem("k")).toBe("v");

    storage.removeItem("k");
    expect(storage.getItem("k")).toBeNull();
  });

  it("createMmkvStorage round-trips through persistSource", async () => {
    const storage = createMmkvStorage<{ count: number }>({ id: "test" })!;

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, { name: "mmkv-json", storage });
    await waitForHydration(persist.hasHydrated);

    source.setState(() => ({ count: 7 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await storage.getItem("mmkv-json"))?.state.count).toBe(7);

    const source2 = createMockSource({ count: 0 });
    const persist2 = persistSource(source2, {
      name: "mmkv-json",
      storage,
      skipHydration: true,
    });
    await persist2.rehydrate();
    expect(source2.state.count).toBe(7);

    persist.destroy();
    persist2.destroy();
  });

  it("imports only from core (no cross-adapter coupling)", async () => {
    const source = await Bun.file(new URL("./mmkv.ts", import.meta.url)).text();
    const relativeImports = [
      ...source.matchAll(/from\s+["'](\.\.?\/[^"']+)["']/g),
    ].map((match) => match[1]);
    for (const importPath of relativeImports) {
      expect(importPath).toMatch(/^\.\.\/\.\.\/core\//);
    }
  });
});
