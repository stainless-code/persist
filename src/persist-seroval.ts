// Seroval codec entry — owns the `seroval` dependency so the core stays
// zero-dep. Ships as its own subpath entry with seroval as an optional peer.
import { fromJSON, toJSON } from "seroval";

import type {
  CreateStorageOptions,
  PersistStorage,
  StateStorage,
  StorageCodec,
  StorageValue,
} from "./persist-core";
import { createStorage } from "./persist-core";

/** Same options as `createStorage` (`clearCorruptOnFailure`). */
export type SerovalStorageOptions = CreateStorageOptions;

/**
 * Seroval codec — round-trips `Set` / `Map` / `Date`. The `toJSON` /
 * `fromJSON` envelope keeps the payload JSON-serializable.
 */
export const serovalCodec = <S>(): StorageCodec<S> => ({
  encode: (value) => JSON.stringify(toJSON(value)),
  decode: (raw) => fromJSON(JSON.parse(raw)) as StorageValue<S>,
});

/**
 * Build a seroval-encoded `PersistStorage` (round-trips `Set`/`Map`/`Date`).
 *
 * @example
 * ```ts
 * // any string-keyed Storage works: localStorage, sessionStorage, custom
 * const storage = createSerovalStorage<Prefs>(() => localStorage, {
 *   clearCorruptOnFailure: true,
 * });
 * ```
 */
export function createSerovalStorage<S>(
  getStorage: () => StateStorage,
  options?: SerovalStorageOptions,
): PersistStorage<S> | undefined {
  return createStorage(getStorage, serovalCodec<S>(), options);
}
