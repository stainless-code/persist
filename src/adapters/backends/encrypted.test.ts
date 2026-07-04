import { beforeEach, describe, expect, it } from "bun:test";

import { createStorage, persistSource } from "../../core/persist-core";
import type { PersistableSource, StateStorage } from "../../core/persist-core";
import { serovalCodec } from "../codecs/seroval";
import { createEncryptedStorage } from "./encrypted";

class MemoryStorage implements StateStorage {
  private store = new Map<string, string>();

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

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

async function makeKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

describe("createEncryptedStorage", () => {
  let memory: MemoryStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  it("round-trips: setItem then getItem returns the plaintext", async () => {
    const storage = createEncryptedStorage(() => memory, {
      key: await makeKey(),
    })!;

    await storage.setItem("k", "secret");
    expect(await storage.getItem("k")).toBe("secret");
  });

  it("the stored value is NOT the plaintext (encrypted base64, iv.ct format)", async () => {
    const storage = createEncryptedStorage(() => memory, {
      key: await makeKey(),
    })!;

    await storage.setItem("k", "secret");
    const raw = memory.getItem("k");
    expect(raw).not.toBe("secret");
    expect(raw).toContain(".");
  });

  it("a wrong key fails to decrypt (AES-GCM auth tag)", async () => {
    const key1 = await makeKey();
    const key2 = await makeKey();
    const storage1 = createEncryptedStorage(() => memory, { key: key1 })!;
    const storage2 = createEncryptedStorage(() => memory, { key: key2 })!;

    await storage1.setItem("k", "secret");
    await expect(storage2.getItem("k")).rejects.toThrow();
  });

  it("getItem returns null for a missing key", async () => {
    const storage = createEncryptedStorage(() => memory, {
      key: await makeKey(),
    })!;

    expect(await storage.getItem("missing")).toBeNull();
  });

  it("composes with createStorage + persistSource end-to-end", async () => {
    const key = await makeKey();
    const name = "encrypted-persist";
    const storage = createStorage<{ count: number }>(
      () => createEncryptedStorage(() => memory, { key })!,
      serovalCodec(),
    )!;

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, { name, storage });
    await waitForHydration(persist.hasHydrated);

    source.setState(() => ({ count: 7 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const rawStored = memory.getItem(name);
    expect(rawStored).not.toBeNull();
    expect(rawStored).not.toContain('"count":7');

    const source2 = createMockSource({ count: 0 });
    const persist2 = persistSource(source2, {
      name,
      storage,
      skipHydration: true,
    });
    await persist2.rehydrate();
    expect(source2.state.count).toBe(7);

    persist.destroy();
    persist2.destroy();
  });

  it("returns undefined when crypto.subtle is unavailable", () => {
    const originalCrypto = globalThis.crypto;
    try {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (globalThis as { crypto?: Crypto }).crypto;
      if (typeof globalThis.crypto !== "undefined") {
        // Non-configurable in this runtime — fall back to getStorage-throws guard.
        expect(
          createEncryptedStorage(
            () => {
              throw new Error("no backend");
            },
            { key: {} as CryptoKey },
          ),
        ).toBeUndefined();
        return;
      }
      expect(
        createEncryptedStorage(() => memory, { key: {} as CryptoKey }),
      ).toBeUndefined();
    } finally {
      globalThis.crypto = originalCrypto;
    }
  });

  it("imports only from core (no cross-adapter coupling)", async () => {
    const source = await Bun.file(
      new URL("./encrypted.ts", import.meta.url),
    ).text();
    const relativeImports = [
      ...source.matchAll(/from\s+["'](\.\.?\/[^"']+)["']/g),
    ].map((match) => match[1]);
    for (const importPath of relativeImports) {
      expect(importPath).toMatch(/^\.\.\/\.\.\/core\//);
    }
  });
});
