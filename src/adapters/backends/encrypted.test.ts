import { beforeEach, describe, expect, it } from "bun:test";

import { createStorage, persistSource } from "../../core/persist-core";
import { itImportsOnlyFromCore } from "../../testing/assert-core-only-imports";
import { MemoryStorage } from "../../testing/memory-storage";
import { createMockSource } from "../../testing/mock-source";
import { waitForHydration } from "../../testing/wait-for-hydration";
import { serovalCodec } from "../codecs/seroval";
import { createCompressedStorage } from "./compressed";
import { createEncryptedStorage } from "./encrypted";

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

  it("composed: a wrong-key hydrate routes to onError phase 'hydrate' and does NOT clearCorrupt (backend reject, not codec throw)", async () => {
    const key1 = await makeKey();
    const key2 = await makeKey();
    const name = "encrypted-wrong-key";

    // Seed an encrypted blob with key1 (await the async encrypt directly).
    const seedStorage = createStorage<{ count: number }>(
      () => createEncryptedStorage(() => memory, { key: key1 })!,
      serovalCodec(),
    )!;
    await seedStorage.setItem(name, { state: { count: 9 }, version: 0 });
    expect(memory.getItem(name)).not.toBeNull();

    // Hydrate the same key with key2 — AES-GCM decrypt throws in the backend's
    // async getItem, which persist-core reports as phase "hydrate". This is NOT
    // the codec's clearCorruptOnFailure path (that fires only when the *codec*
    // throws parsing a raw value), so the encrypted blob stays in storage.
    // `skipHydration` + `await rehydrate()` (not `waitForHydration`) because the
    // decrypt reject settles on a macrotask (crypto.subtle) — microtask polling
    // never yields to it.
    const errors: Array<{ phase: string }> = [];
    const wrongStorage = createStorage<{ count: number }>(
      () => createEncryptedStorage(() => memory, { key: key2 })!,
      serovalCodec(),
      { clearCorruptOnFailure: true },
    )!;
    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name,
      storage: wrongStorage,
      skipHydration: true,
      onError: (_e, ctx) => errors.push({ phase: ctx.phase }),
    });
    await persist.rehydrate();

    expect(errors).toContainEqual({ phase: "hydrate" });
    expect(memory.getItem(name)).not.toBeNull();
    expect(source.state.count).toBe(0);
    persist.destroy();
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

  it("returns undefined when the backend is missing a required method", () => {
    const broken = {
      getItem: () => null,
      setItem: () => {},
      // removeItem missing
    } as unknown as import("../../core/persist-core").StateStorage<string>;
    expect(
      createEncryptedStorage(() => broken, { key: {} as CryptoKey }),
    ).toBeUndefined();
  });

  it("decrypt rejects a malformed ciphertext payload (missing separator)", async () => {
    const key = await makeKey();
    const storage = createEncryptedStorage(() => memory, { key })!;
    memory.setItem("malformed", "not-a-valid-ciphertext-no-separator");
    await expect(storage.getItem("malformed")).rejects.toThrow(
      /invalid ciphertext payload/,
    );
  });

  it("compress-then-encrypt stack round-trips (the documented recipe)", async () => {
    const key = await makeKey();
    const memory = new MemoryStorage();
    const encrypted = createEncryptedStorage(() => memory, { key })!;
    const compressed = createCompressedStorage(() => encrypted)!;

    const plaintext = "hello world hello world hello world";
    await compressed.setItem("stack", plaintext);

    const raw = memory.getItem("stack")!;
    expect(raw).toContain(".");
    expect(raw).not.toContain("hello world");

    expect(await compressed.getItem("stack")).toBe(plaintext);
  });

  itImportsOnlyFromCore(new URL("./encrypted.ts", import.meta.url));
});
