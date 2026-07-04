---
"@stainless-code/persist": minor
---

Add two zero-dep storage wrappers over the `StateStorage` seam — both async web-global adapters (no peer dep), composing with `createStorage(backend, codec)`:

- `./backends/encrypted` — `createEncryptedStorage(getStorage, { key })`: AES-GCM via WebCrypto (`crypto.subtle`). Each stored value is `base64(iv).base64(ciphertext)`; the AES-GCM auth tag means a wrong key or tampered ciphertext throws on decrypt → persist-core's corrupt-payload path returns `null` (or `clearCorruptOnFailure` removes the key). Returns `undefined` when `crypto.subtle` is unavailable so `createStorage` collapses to the no-op `PersistApi`.
- `./backends/compressed` — `createCompressedStorage(getStorage, { format? })`: native `CompressionStream`/`DecompressionStream` (`gzip` | `deflate` | `deflate-raw`, default `gzip`); output is base64 so it stays string-wire. Returns `undefined` when the stream APIs are unavailable. Stacks with `createEncryptedStorage` (compress-then-encrypt is the standard order).

**Design note:** encryption + compression are backend **wrappers**, not sync `StorageCodec`s, because `crypto.subtle` and the stream APIs are async and the `StorageCodec` seam is sync. The codec serializes the envelope (sync); the wrapper encrypts/compresses the serialized string (async). Co-located tests (round-trip, ciphertext-not-plaintext, wrong-key-fails / compression-ratio, missing-key, formats, persistSource end-to-end, availability guard, dependency isolation).

Also adds a README comparison table vs zustand-persist / redux-persist / @tanstack/query-persist-client / pinia-persist, and a migration guide with option-mapping tables + port snippets for each incumbent.
