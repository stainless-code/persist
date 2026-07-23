---
name: persist-compressed
description: Compress a string-wire StateStorage with @stainless-code/persist/backends/compressed (gzip/deflate). Backend wrapper — compose with createStorage; stack compress-then-encrypt.
license: MIT
metadata:
  type: composition
  library: "@stainless-code/persist"
  library_version: "0.4.0"
requires:
  - persist
sources:
  - stainless-code/persist:src/adapters/backends/compressed.ts
---

# Compressed backend wrapper

This skill builds on `persist`.

**Not a `StorageCodec`.** Uses `CompressionStream` / `DecompressionStream` (default `gzip`); output is **base64** on the string wire. Returns `undefined` if streams unavailable. Documented stack with encryption: **compress → encrypt**.

## Minimal wiring

```ts
import { createStorage } from "@stainless-code/persist";
import { createCompressedStorage } from "@stainless-code/persist/backends/compressed";
import { serovalCodec } from "@stainless-code/persist/codecs/seroval";

const storage = createStorage<Prefs>(
  () => createCompressedStorage(() => localStorage)!,
  serovalCodec(),
);
```

Formats: `gzip` | `deflate` | `deflate-raw` (`deflate-raw` needs newer Node).

## Common mistakes

- **Using as a codec.**
- **Encrypt-then-compress.**
- **Assuming streams exist in every runtime.**

## API surface

- `createCompressedStorage(getStorage, { format? }) → StateStorage<string> | undefined`

See also: `persist-encrypted`; `persist`.
