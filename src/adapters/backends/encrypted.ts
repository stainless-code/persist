// AES-GCM encrypted storage wrapper — no peer dep (`crypto.subtle` is a web global, browsers + Node 20+). String-wire backends.
import type { StateStorage } from "../../core/persist-core";

export interface CreateEncryptedStorageOptions {
  /** AES-GCM `CryptoKey` — derive via `crypto.subtle.importKey` / `generateKey`. */
  key: CryptoKey;
}

/**
 * AES-GCM encryption over a string-wire `StateStorage` (WebCrypto). Each
 * stored value is `base64(iv).base64(ciphertext)` (12-byte IV prepended); the
 * auth tag means a wrong key or tampered ciphertext throws on decrypt →
 * persist-core's corrupt-payload path returns `null` (or `clearCorruptOnFailure`
 * removes the key).
 *
 * A backend **wrapper**, not a sync `StorageCodec`, because `crypto.subtle`
 * is async — the codec serializes (sync), this encrypts the string (async).
 * Compose: `createStorage(() => createEncryptedStorage(backend, { key }), codec)`.
 * Returns `undefined` when `crypto.subtle` is unavailable.
 *
 * @example
 * ```ts
 * const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
 * const storage = createStorage<Prefs>(
 *   () => createEncryptedStorage(() => localStorage, { key })!,
 *   serovalCodec(),
 * );
 * persistStore(store, { name: "app:prefs:v1", storage, clearCorruptOnFailure: true });
 * ```
 */
export function createEncryptedStorage(
  getStorage: () => StateStorage<string>,
  options: CreateEncryptedStorageOptions,
): StateStorage<string> | undefined {
  if (typeof crypto === "undefined" || !crypto?.subtle) {
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

  return {
    getItem: async (name) => {
      const raw = await backend.getItem(name);
      if (raw == null) return null;
      return decryptAesGcm(raw, options.key);
    },
    setItem: async (name, value) => {
      const ciphertext = await encryptAesGcm(value, options.key);
      await backend.setItem(name, ciphertext);
    },
    removeItem: (name) => backend.removeItem(name),
  };
}

async function encryptAesGcm(
  plaintext: string,
  key: CryptoKey,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded),
  );
  return `${toBase64(iv)}.${toBase64(ciphertext)}`;
}

async function decryptAesGcm(payload: string, key: CryptoKey): Promise<string> {
  const [ivB64, ctB64] = payload.split(".");
  if (!ivB64 || !ctB64) throw new Error("invalid ciphertext payload");
  const iv = fromBase64(ivB64);
  const ciphertext = fromBase64(ctB64);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(plain);
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
