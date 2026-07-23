---
name: persist-node-fs
description: Persist to the filesystem with @stainless-code/persist/backends/node-fs (nodeFsStateStorage). StateStorage only — compose createStorage + codec; one file per key with hash suffix.
license: MIT
metadata:
  type: composition
  library: "@stainless-code/persist"
  library_version: "0.4.1"
requires:
  - persist
sources:
  - stainless-code/persist:src/adapters/backends/node-fs.ts
---

# Node filesystem backend

Exports **`nodeFsStateStorage({ dir })` only** — compose with `createStorage` + a codec. One file per key; sanitized name + **djb2 hash** suffix (collision-safe). Refuses keys that sanitize to `.` / `..` / `""`. ENOENT → null / no-op remove.

## Minimal wiring

```ts
import { createStorage, jsonCodec } from "@stainless-code/persist";
import { nodeFsStateStorage } from "@stainless-code/persist/backends/node-fs";

const storage = createStorage<Prefs>(
  () => nodeFsStateStorage({ dir: "./.persist" }),
  jsonCodec(),
);
```

No optional peer for this backend — uses `node:fs`. Richer graphs → `persist-seroval` as the codec.

## Common mistakes

- **Expecting a `create*Storage` PersistStorage factory.**
- **Assuming sanitize alone makes unique paths** — the hash suffix is required for collisions.
- **Path-traversal keys** — refused after sanitize.

## API surface

- `nodeFsStateStorage({ dir }) → StateStorage<string>`
