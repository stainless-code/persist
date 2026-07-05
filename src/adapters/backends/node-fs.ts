// Node fs storage backend — no peer dep (node:fs is a Node built-in). One file per key; for server/SSR/CLI.
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { StateStorage } from "../../core/persist-core";

export interface NodeFsStorageOptions {
  /** Directory holding one file per persisted key (created lazily on first write). */
  dir: string;
}

/**
 * Node `fs` storage backend — one file per key under `dir` (async `fs.promises`).
 * Keys are sanitized to filename-safe segments (`app:prefs:v1` → `app_prefs_v1`).
 * Compose with `createStorage(() => nodeFsStateStorage({ dir }), codec)`.
 *
 * @example
 * ```ts
 * import { createStorage } from "@stainless-code/persist";
 * import { serovalCodec } from "@stainless-code/persist/codecs/seroval";
 * import { nodeFsStateStorage } from "@stainless-code/persist/backends/node-fs";
 *
 * const storage = createStorage<Prefs>(() => nodeFsStateStorage({ dir: "./.persist" }), serovalCodec());
 * ```
 */
export function nodeFsStateStorage(
  options: NodeFsStorageOptions,
): StateStorage<string> {
  const { dir } = options;

  const pathFor = (name: string) => {
    const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_");
    // `.` survives the sanitizer, so `name === ".."` / `"."` would resolve
    // outside `dir` (parent / self). Refuse rather than EISDIR at I/O time.
    if (safe === ".." || safe === "." || safe === "") {
      throw new Error(
        `[nodeFsStateStorage] key "${name}" sanitizes to "${safe}" — refusing to resolve outside dir`,
      );
    }
    return join(dir, safe);
  };

  return {
    getItem: async (name) => {
      try {
        return await readFile(pathFor(name), "utf8");
      } catch {
        return null;
      }
    },
    setItem: async (name, value) => {
      await mkdir(dir, { recursive: true });
      await writeFile(pathFor(name), value, "utf8");
    },
    removeItem: async (name) => {
      try {
        await unlink(pathFor(name));
      } catch {
        /* missing file — nothing to remove */
      }
    },
  };
}
