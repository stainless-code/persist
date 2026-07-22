---
"@stainless-code/persist": minor
---

Add `./codecs/standard-schema` — sync `~standard` codec, `PersistStorage` wraps (`withStandardSchema` / `withStandardSchemaAsync`), and JSON factories. Types vendored; no runtime peer. `createStorage` rethrows `PersistDecodeRethrowError` from decode (wrong-lane / programmer errors — not clearCorrupt).

Remove `./codecs/zod`. Migrate to `createStandardSchemaStorage(getStorage, schema)` (Zod ≥3.24 / v4 via `~standard`). Encode writes schema `value` (defaults/transforms). Yup / async `~standard.validate` → async lane (async hydrate — gate UI).
