// Zod codec entry — owns the `zod` dependency so the core stays
// zero-dep. Ships as its own subpath entry with zod as an optional peer.
import { ZodType } from "zod";

import type {
  CreateStorageOptions,
  PersistStorage,
  StateStorage,
  StorageCodec,
  StorageValue,
} from "../../core/persist-core";
import { createStorage } from "../../core/persist-core";

/** Same options as `createStorage` (`clearCorruptOnFailure`). */
export type ZodStorageOptions = CreateStorageOptions;

/**
 * zod-validated codec — `encode` validates the state before serializing the
 * envelope (invalid state never persists; throws surface via `onError` phase
 * "write"), `decode` parses + validates the stored state (a validation
 * failure throws → persist-core's corrupt-payload path returns null, or with
 * `clearCorruptOnFailure` removes the key). Validates `state` only; version /
 * timestamp / buster are the envelope's concern, not the schema's.
 */
export function zodCodec<S>(schema: ZodType<S>): StorageCodec<S> {
  return {
    encode: (value) => {
      schema.parse(value.state);
      return JSON.stringify(value);
    },
    decode: (raw) => {
      const envelope = JSON.parse(raw) as StorageValue<S>;
      return { ...envelope, state: schema.parse(envelope.state) };
    },
  };
}

/**
 * Build a zod-validated `PersistStorage`. Any string-keyed `StateStorage` works
 * (localStorage, sessionStorage, custom).
 *
 * @example
 * ```ts
 * import { z } from "zod";
 * const Prefs = z.object({ theme: z.enum(["light", "dark"]) });
 * const storage = createZodStorage<z.infer<typeof Prefs>>(() => localStorage, Prefs, {
 *   clearCorruptOnFailure: true,
 * });
 * ```
 */
export function createZodStorage<S>(
  getStorage: () => StateStorage,
  schema: ZodType<S>,
  options?: ZodStorageOptions,
): PersistStorage<S> | undefined {
  return createStorage(getStorage, zodCodec(schema), options);
}
