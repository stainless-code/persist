// Compressed storage entry — owns NO peer dep (`CompressionStream` /
// `DecompressionStream` are web globals, available in browsers + Node 18+). Ships
// as its own subpath so consumers not compressing don't pull it. For
// string-wire backends (localStorage, AsyncStorage, etc.); output is
// base64-encoded so it stays string-wire.
import type { StateStorage } from "../../core/persist-core";

export type CompressionFormat = "gzip" | "deflate" | "deflate-raw";

export interface CreateCompressedStorageOptions {
  /** Compression format. @default "gzip" */
  format?: CompressionFormat;
}

/**
 * Wrap a string-wire `StateStorage` with native `CompressionStream` /
 * `DecompressionStream` compression. Supported formats: `gzip`, `deflate`,
 * `deflate-raw`. Output is base64-encoded so it stays string-wire.
 *
 * Compression is a backend wrapper, **not** a sync `StorageCodec`, because
 * the stream APIs are async — the `StorageCodec` seam is sync. Compose with
 * `createStorage(backend, codec)`: the codec serializes the envelope (sync),
 * this wrapper compresses the serialized string (async).
 *
 * Returns `undefined` when the stream APIs are unavailable so `createStorage`
 * collapses to the no-op `PersistApi`. Stacks with `createEncryptedStorage`
 * (compress-then-encrypt is the standard order).
 *
 * @example
 * ```ts
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
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
