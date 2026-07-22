---
"@stainless-code/persist": patch
---

`createStorage` rethrows `PersistDecodeRethrowError` from codec decode (not corrupt / clearCorrupt). Standard Schema wrong-lane async validate uses it so `standardSchemaCodec` + `clearCorruptOnFailure` no longer deletes valid keys.
