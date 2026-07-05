import { beforeEach, describe, expect, it, mock } from "bun:test";

import { createMockSource } from "../../testing/mock-source";
import { waitForHydration } from "../../testing/wait-for-hydration";

// bun has no React Native runtime — fake AsyncStorage with a Map-backed
// implementation. The module under test only maps shapes; real RN behavior is
// AsyncStorage's concern.
const store = new Map<string, string>();

mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: (key: string) => Promise.resolve(store.get(key) ?? null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      store.delete(key);
      return Promise.resolve();
    },
  },
}));

const { asyncStorageStateStorage, createAsyncStorage } =
  await import("./async-storage");
const { persistSource } = await import("../../core/persist-core");

describe("createAsyncStorage", () => {
  beforeEach(() => store.clear());

  it("asyncStorageStateStorage maps the async backend", async () => {
    const storage = asyncStorageStateStorage();
    expect(await storage.getItem("missing")).toBeNull();

    await storage.setItem("k", "v");
    expect(await storage.getItem("k")).toBe("v");

    await storage.removeItem("k");
    expect(await storage.getItem("k")).toBeNull();
  });

  it("createAsyncStorage round-trips through persistSource", async () => {
    const storage = createAsyncStorage<{ count: number }>()!;

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, { name: "async-json", storage });
    await waitForHydration(persist.hasHydrated);

    source.setState(() => ({ count: 7 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await storage.getItem("async-json"))?.state.count).toBe(7);

    const source2 = createMockSource({ count: 0 });
    const persist2 = persistSource(source2, {
      name: "async-json",
      storage,
      skipHydration: true,
    });
    await persist2.rehydrate();
    expect(source2.state.count).toBe(7);

    persist.destroy();
    persist2.destroy();
  });

  it("imports only from core (no cross-adapter coupling)", async () => {
    const source = await Bun.file(
      new URL("./async-storage.ts", import.meta.url),
    ).text();
    const relativeImports = [
      ...source.matchAll(/from\s+["'](\.\.?\/[^"']+)["']/g),
    ].map((match) => match[1]);
    for (const importPath of relativeImports) {
      expect(importPath).toMatch(/^\.\.\/\.\.\/core\//);
    }
  });
});
