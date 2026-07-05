import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createStorage, persistSource } from "../../core/persist-core";
import { createMockSource } from "../../testing/mock-source";
import { serovalCodec } from "../codecs/seroval";
import { nodeFsStateStorage } from "./node-fs";

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "persist-nodefs-"));
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
      // node:fs I/O settles on macrotasks — microtasks alone never yield here.
      setTimeout(tick, 0);
    };
    tick();
  });
}

describe("nodeFsStateStorage", () => {
  it("round-trips: setItem then getItem returns the value; removeItem then getItem → null", async () => {
    const dir = await tempDir();
    try {
      const storage = nodeFsStateStorage({ dir });
      await storage.setItem("k", "v");
      expect(await storage.getItem("k")).toBe("v");
      await storage.removeItem("k");
      expect(await storage.getItem("k")).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("getItem returns null for a missing key (no throw)", async () => {
    const dir = await tempDir();
    try {
      const storage = nodeFsStateStorage({ dir });
      expect(await storage.getItem("missing")).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("setItem creates the dir if it does not exist", async () => {
    const base = await tempDir();
    const dir = join(base, "nested", "persist");
    try {
      const storage = nodeFsStateStorage({ dir });
      await storage.setItem("k", "v");
      expect(await readFile(join(dir, "k"), "utf8")).toBe("v");
      expect(await storage.getItem("k")).toBe("v");
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("keys with unsafe chars are sanitized to filename-safe segments", async () => {
    const dir = await tempDir();
    try {
      const storage = nodeFsStateStorage({ dir });
      await storage.setItem("app:prefs:v1", "prefs");
      const files = await readdir(dir);
      expect(files).toContain("app_prefs_v1");
      expect(await storage.getItem("app:prefs:v1")).toBe("prefs");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("composes with createStorage + persistSource end-to-end", async () => {
    const dir = await tempDir();
    try {
      const name = "node-fs-persist";
      const storage = createStorage<{ count: number }>(
        () => nodeFsStateStorage({ dir }),
        serovalCodec(),
      )!;

      const source = createMockSource({ count: 0 });
      const persist = persistSource(source, { name, storage });
      await waitForHydration(persist.hasHydrated);

      source.setState(() => ({ count: 7 }));
      await new Promise((resolve) => setTimeout(resolve, 0));

      const stored = await storage.getItem(name);
      expect(stored?.state.count).toBe(7);

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
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("imports only from core (no cross-adapter coupling)", async () => {
    const source = await Bun.file(
      new URL("./node-fs.ts", import.meta.url),
    ).text();
    const relativeImports = [
      ...source.matchAll(/from\s+["'](\.\.?\/[^"']+)["']/g),
    ].map((m) => m[1]);
    for (const imp of relativeImports) {
      expect(imp).toMatch(/^\.\.\/\.\.\/core\//);
    }
  });
});
