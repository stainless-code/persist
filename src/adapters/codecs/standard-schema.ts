// Standard Schema–gated codec + sync/async PersistStorage wraps — zero
// runtime deps; types vendored from https://standardschema.dev
// (StandardSchemaV1).
import type {
  CreateStorageOptions,
  PersistStorage,
  StateStorage,
  StorageCodec,
  StorageValue,
} from "../../core/persist-core";
import { createStorage, jsonCodec } from "../../core/persist-core";

/**
 * Minimal vendored Standard Schema v1 types.
 * Vendoring keeps schema integration type-only and avoids a runtime dependency.
 *
 * @see https://standardschema.dev
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}

export declare namespace StandardSchemaV1 {
  export interface Props<Input = unknown, Output = Input> {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown,
    ) => Result<Output> | Promise<Result<Output>>;
    readonly types?: Types<Input, Output> | undefined;
  }
  export type Result<Output> = SuccessResult<Output> | FailureResult;
  export interface SuccessResult<Output> {
    readonly value: Output;
    readonly issues?: undefined;
  }
  export interface FailureResult {
    readonly issues: ReadonlyArray<Issue>;
  }
  export interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
  }
  export interface PathSegment {
    readonly key: PropertyKey;
  }
  export interface Types<Input = unknown, Output = Input> {
    readonly input: Input;
    readonly output: Output;
  }
  export type InferInput<Schema extends StandardSchemaV1> = NonNullable<
    Schema["~standard"]["types"]
  >["input"];
  export type InferOutput<Schema extends StandardSchemaV1> = NonNullable<
    Schema["~standard"]["types"]
  >["output"];
}

/** Same options as `createStorage` (`clearCorruptOnFailure`). */
export type StandardSchemaStorageOptions = CreateStorageOptions;

const ASYNC_VALIDATE_SYNC_LANE_MESSAGE =
  "[@stainless-code/persist] Async Standard Schema validation is not supported — use withStandardSchemaAsync.";

function isAsyncValidateSyncLaneError(error: unknown): boolean {
  return (
    error instanceof Error && error.message === ASYNC_VALIDATE_SYNC_LANE_MESSAGE
  );
}

function validateSync<Output>(
  schema: StandardSchemaV1<unknown, Output>,
  input: unknown,
): Output {
  const result = schema["~standard"].validate(input);
  if (result instanceof Promise) {
    // Contain abandoned rejections — same pattern as persist-core write paths.
    void result.catch(() => {});
    throw new Error(ASYNC_VALIDATE_SYNC_LANE_MESSAGE);
  }
  if (result.issues) {
    throw new Error(
      result.issues.map((i) => i.message).join("; ") || "Validation failed",
    );
  }
  return result.value;
}

async function validateAsync<Output>(
  schema: StandardSchemaV1<unknown, Output>,
  input: unknown,
): Promise<Output> {
  const result = await schema["~standard"].validate(input);
  if (result.issues) {
    throw new Error(
      result.issues.map((i) => i.message).join("; ") || "Validation failed",
    );
  }
  return result.value;
}

/**
 * Sync `~standard` codec for `state` only. Encode persists schema `value`
 * (defaults/transforms); throws → `onError` `"write"`. Decode failures →
 * corrupt path (`null` / `clearCorruptOnFailure`). Async validate throws —
 * under `createStorage` + `clearCorruptOnFailure` that throw is treated as
 * corrupt (prefer `withStandardSchema`, which rethrows wrong-lane errors).
 * Envelope `version` / `timestamp` / `buster` are not schema-checked.
 */
export function standardSchemaCodec<Output>(
  schema: StandardSchemaV1<unknown, Output>,
): StorageCodec<Output> {
  return {
    encode: (value) => {
      const state = validateSync(schema, value.state);
      return JSON.stringify({ ...value, state });
    },
    decode: (raw) => {
      const envelope = JSON.parse(raw) as StorageValue<Output>;
      return { ...envelope, state: validateSync(schema, envelope.state) };
    },
  };
}

/**
 * Sync `~standard` wrap over an existing `PersistStorage` (typed envelope
 * already decoded). Promise-aware for backend `getItem` only — async schemas
 * throw toward `withStandardSchemaAsync`.
 */
export function withStandardSchema<S>(
  storage: PersistStorage<S>,
  schema: StandardSchemaV1<unknown, S>,
  options?: StandardSchemaStorageOptions,
): PersistStorage<S> {
  const gate = (
    name: string,
    value: StorageValue<S> | null,
  ): StorageValue<S> | null => {
    if (value === null) return null;
    try {
      return { ...value, state: validateSync(schema, value.state) };
    } catch (error) {
      // Wrong lane (async ~standard on sync wrap) is a programmer error — never
      // treat as corrupt / clearCorrupt (would delete valid keys).
      if (isAsyncValidateSyncLaneError(error)) throw error;
      if (options?.clearCorruptOnFailure) {
        // Best-effort cleanup; async removeItem must not leak unhandled rejection.
        try {
          const removal = storage.removeItem(name);
          if (removal instanceof Promise) void removal.catch(() => {});
        } catch {
          // sync removeItem throw — corrupt already neutralized by returning null
        }
      }
      return null;
    }
  };

  return {
    getItem(name) {
      const value = storage.getItem(name) ?? null;
      if (value instanceof Promise) {
        return value.then((resolved) => gate(name, resolved ?? null));
      }
      return gate(name, value);
    },
    setItem(name, value) {
      const state = validateSync(schema, value.state);
      return storage.setItem(name, { ...value, state });
    },
    removeItem(name) {
      return storage.removeItem(name);
    },
    raw: storage.raw,
  };
}

/**
 * Async `~standard` wrap over an existing `PersistStorage`. Awaits validate
 * (sync schemas OK). Prefer this for Yup / async refine; use
 * `withStandardSchema` for sync-only schemas.
 */
export function withStandardSchemaAsync<S>(
  storage: PersistStorage<S>,
  schema: StandardSchemaV1<unknown, S>,
  options?: StandardSchemaStorageOptions,
): PersistStorage<S> {
  return {
    async getItem(name) {
      const value = (await storage.getItem(name)) ?? null;
      if (value === null) return null;
      try {
        const state = await validateAsync(schema, value.state);
        return { ...value, state };
      } catch {
        if (options?.clearCorruptOnFailure) {
          try {
            await storage.removeItem(name);
          } catch {
            // best-effort cleanup — corrupt already neutralized by returning null
          }
        }
        return null;
      }
    },
    async setItem(name, value) {
      const state = await validateAsync(schema, value.state);
      await storage.setItem(name, { ...value, state });
    },
    async removeItem(name) {
      await storage.removeItem(name);
    },
    raw: storage.raw,
  };
}

/**
 * Build a Standard Schema–gated `PersistStorage` over any string-keyed
 * `StateStorage`. JSON sugar over `withStandardSchema` — pass a schema that
 * implements sync `~standard`.
 *
 * @example
 * ```ts
 * import { z } from "zod";
 * const prefs = z.object({ theme: z.enum(["light", "dark"]) });
 * const storage = createStandardSchemaStorage<{ theme: "light" | "dark" }>(
 *   () => localStorage,
 *   prefs,
 *   { clearCorruptOnFailure: true },
 * );
 * ```
 */
export function createStandardSchemaStorage<Output>(
  getStorage: () => StateStorage,
  schema: StandardSchemaV1<unknown, Output>,
  options?: StandardSchemaStorageOptions,
): PersistStorage<Output> | undefined {
  const inner = createStorage(getStorage, jsonCodec<Output>(), options);
  if (!inner) return;
  return withStandardSchema(inner, schema, options);
}

/**
 * JSON sugar over `withStandardSchemaAsync` for async `~standard` schemas
 * (Yup, async refine). Sync schemas also work through this lane.
 *
 * @example
 * ```ts
 * // Async ~standard (Yup / async refine) — or a sync schema like zod.
 * const storage = createStandardSchemaStorageAsync<{ count: number }>(
 *   () => localStorage,
 *   schema,
 *   { clearCorruptOnFailure: true },
 * );
 * ```
 */
export function createStandardSchemaStorageAsync<Output>(
  getStorage: () => StateStorage,
  schema: StandardSchemaV1<unknown, Output>,
  options?: StandardSchemaStorageOptions,
): PersistStorage<Output> | undefined {
  const inner = createStorage(getStorage, jsonCodec<Output>(), options);
  if (!inner) return;
  return withStandardSchemaAsync(inner, schema, options);
}
