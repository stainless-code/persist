---
name: persist-encrypted
description: AES-GCM encrypt a string-wire StateStorage with @stainless-code/persist/backends/encrypted (createEncryptedStorage). Backend wrapper — compose with createStorage + codec; wrong key rejects hydrate (not clearCorrupt).
license: MIT
metadata:
  type: composition
  library: "@stainless-code/persist"
  library_version: "0.4.1"
requires:
  - persist
sources:
  - stainless-code/persist:src/adapters/backends/encrypted.ts
---

# Encrypted backend wrapper

**Not a `StorageCodec`.** Wraps an inner string `StateStorage` with WebCrypto AES-GCM (`base64(iv).base64(ct)`). Returns `undefined` if `crypto.subtle` missing. Stack with compression: **compress → encrypt**.

Decrypt failure (wrong key / tamper) → backend `getItem` **rejects** → `onError` phase `"hydrate"` — **not** the codec `clearCorruptOnFailure` path.

## Minimal wiring

```ts
import { createStorage, jsonCodec } from "@stainless-code/persist";
import { createEncryptedStorage } from "@stainless-code/persist/backends/encrypted";

const key = await crypto.subtle.generateKey(
  { name: "AES-GCM", length: 256 },
  true,
  ["encrypt", "decrypt"],
);
const storage = createStorage<Prefs>(
  () => createEncryptedStorage(() => localStorage, { key })!,
  jsonCodec(),
  { clearCorruptOnFailure: true },
);
```

Richer graphs → compose with `persist-seroval` instead of `jsonCodec`.

## Common mistakes

- **Treating this as a sync codec.**
- **Expecting clearCorrupt on decrypt fail.**
- **Encrypt-then-compress** — reverse of the documented stack.

## API surface

- `createEncryptedStorage(getStorage, { key }) → StateStorage<string> | undefined`

See also: `persist-compressed`.
