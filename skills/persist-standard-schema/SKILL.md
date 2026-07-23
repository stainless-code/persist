---
name: persist-standard-schema
description: Validate persisted state with Standard Schema (~standard) via withStandardSchema / withStandardSchemaAsync / createStandardSchemaStorage. Use for Zod/Yup (etc.) sync vs async lanes and PersistDecodeRethrowError.
license: MIT
metadata:
  type: composition
  library: "@stainless-code/persist"
  library_version: "0.4.0"
requires:
  - persist
sources:
  - stainless-code/persist:src/adapters/codecs/standard-schema.ts
  - stainless-code/persist:apps/docs/content/recipes/standard-schema.mdx
---

# Standard Schema codec / wraps

This skill builds on `persist`. Types for `~standard` are **vendored** — no runtime peer. Bring Zod / Yup / Valibot yourself.

Validates persisted **`state` only** (not envelope `version` / `timestamp` / `buster`). Encode writes schema **output** (defaults/transforms applied).

## Sync vs async lanes

| API                                                            | When                                             |
| -------------------------------------------------------------- | ------------------------------------------------ |
| `withStandardSchema` / `createStandardSchemaStorage`           | Sync `validate` (Zod ≥3.24 / v4 via `~standard`) |
| `withStandardSchemaAsync` / `createStandardSchemaStorageAsync` | Async `validate` (Yup, async Zod)                |

Wrong lane: sync wrap + async schema → `PersistDecodeRethrowError` (rethrown; **not** `clearCorrupt`). Async lane → async hydrate → gate UI (`react-persist`, …).

Sync wrap is still Promise-aware for async **backend** `getItem` (e.g. IDB).

## Minimal wiring

```ts
import { withStandardSchema } from "@stainless-code/persist/codecs/standard-schema";
import { createIdbStorage } from "@stainless-code/persist/backends/idb";

const storage = withStandardSchema(createIdbStorage<Prefs>()!, prefsSchema, {
  clearCorruptOnFailure: true,
});
```

JSON sugar: `createStandardSchemaStorage(() => localStorage, schema)`.

## Common mistakes

- **Async schema on the sync wrap.**
- **Treating wrong-lane throws as corrupt** — they must not clear storage.
- **Schema-checking the whole envelope** — only `state`.
- **Skipping `useHydrated` on the async lane.**
- **Stacking wrap + `standardSchemaCodec`** — double-validates; pick one.

## API surface

- `standardSchemaCodec(schema)` · `withStandardSchema` / `withStandardSchemaAsync`
- `createStandardSchemaStorage` / `createStandardSchemaStorageAsync`

See also: `persist-idb` for async backends.
