---
"@stainless-code/persist": minor
---

Add `./codecs/standard-schema` — sync `~standard` codec plus `PersistStorage` wraps (`withStandardSchema` / `withStandardSchemaAsync`) and JSON factories (`createStandardSchemaStorage` / `createStandardSchemaStorageAsync`). Types vendored; no runtime peer.

Remove `./codecs/zod`. Migrate to `createStandardSchemaStorage(getStorage, schema)` (Zod ≥3.24 / v4 via `~standard`). Encode now writes defaults/transforms (replaces side-effect `parse`). Yup / Promise-returning `~standard.validate` → async wrap or factory (always-async hydrate — gate UI).
