---
"@stainless-code/persist": minor
---

Add `./zod` subpath — `zodCodec` / `createZodStorage`, a schema-gated codec over the `StorageCodec` seam. `encode` validates `state` against a `ZodType` before serializing the envelope (invalid state never persists; the throw surfaces via `onError` phase `"write"`). `decode` parses + validates the stored `state`; a validation failure throws into persist-core's corrupt-payload path → returns `null`, or with `clearCorruptOnFailure` removes the key. Validates `state` only — `version` / `timestamp` / `buster` stay the envelope's concern. `zod` is an optional peer (`>=3.20.0`, stable across v3/v4 via `ZodType` + `.parse`).
