// Compressed storage wrapper — no peer dep (`CompressionStream`/`DecompressionStream` are web globals, browsers + Node 18+ for gzip/deflate; Node 20.12+ for `deflate-raw`). String-wire backends; output is base64.
import type { StateStorage } from "../../core/persist-core";

export type CompressionFormat = "gzip" | "deflate" | "deflate-raw";

export interface CreateCompressedStorageOptions {
  /** Compression format. @default "gzip" */
  format?: CompressionFormat;
}

/**
 * Native `CompressionStream`/`DecompressionStream` compression over a
 * string-wire `StateStorage`. Formats: `gzip` (default), `deflate`,
 * `deflate-raw`; output is base64 so it stays string-wire.
 *
 * A backend **wrapper**, not a sync `StorageCodec`, because the stream APIs
 * are async. Compose: `createStorage(() => createCompressedStorage(backend), codec)`.
 * Returns `undefined` when the stream APIs are unavailable. Stacks with
 * `createEncryptedStorage` (compress-then-encrypt is the standard order).
 *
 * @example
 * ```ts
 * import { createStorage } from "@stainless-code/persist";
 * import { createCompressedStorage } from "@stainless-code/persist/backends/compressed";
 * import { serovalCodec } from "@stainless-code/persist/codecs/seroval";
 *
 * const storage = createStorage<Prefs>(
 *   () => createCompressedStorage(() => localStorage)!,
 *   serovalCodec(),
 * );
 * ```
 */
export function createCompressedStorage(
  getStorage: () => StateStorage<string>,
  options?: CreateCompressedStorageOptions,
): StateStorage<string> | undefined {
  if (
    typeof CompressionStream === "undefined" ||
    typeof DecompressionStream === "undefined"
  ) {
    return undefined;
  }

  let backend: StateStorage<string>;
  try {
    backend = getStorage();
  } catch {
    return undefined;
  }

  if (
    typeof backend.getItem !== "function" ||
    typeof backend.setItem !== "function" ||
    typeof backend.removeItem !== "function"
  ) {
    return undefined;
  }

  const format: CompressionFormat = options?.format ?? "gzip";

  return {
    getItem: async (name) => {
      const raw = await backend.getItem(name);
      if (raw == null) return null;
      return decompress(raw, format);
    },
    setItem: async (name, value) => {
      const compressed = await compress(value, format);
      await backend.setItem(name, compressed);
    },
    removeItem: (name) => backend.removeItem(name),
  };
}

async function compress(
  plaintext: string,
  format: CompressionFormat,
): Promise<string> {
  const stream = new Blob([new TextEncoder().encode(plaintext)])
    .stream()
    .pipeThrough(new CompressionStream(format));
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  return toBase64(buf);
}

async function decompress(
  payload: string,
  format: CompressionFormat,
): Promise<string> {
  const bytes = fromBase64(payload);
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream(format));
  const buf = await new Response(stream).arrayBuffer();
  return new TextDecoder().decode(buf);
}

function toBase64(bytes: Uint8Array): string {
  // Array.from + join — O(n), not the O(n²) of per-byte string concat.
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
}

function fromBase64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
