---
name: persist-node-fs
description: Persist to the filesystem with @stainless-code/persist/backends/node-fs (nodeFsStateStorage). StateStorage only — compose createStorage + codec; one file per key with hash suffix.
license: MIT
metadata:
  type: composition
  library: "@stainless-code/persist"
  library_version: "0.4.0"
requires:
  - persist
sources:
  - stainless-code/persist:src/adapters/backends/node-fs.ts
---

# Node filesystem backend

This skill builds on `persist`.

Exports **`nodeFsStateStorage({ dir })` only** — compose with `createStorage` + a codec. One file per key; sanitized name + **djb2 hash** suffix (collision-safe). Refuses keys that sanitize to `.` / `..` / `""`. ENOENT → null / no-op remove.

## Minimal wiring

```ts
import { createStorage } from "@stainless-code/persist";
import { nodeFsStateStorage } from "@stainless-code/persist/backends/node-fs";
import { serovalCodec } from "@stainless-code/persist/codecs/seroval";

const storage = createStorage<Prefs>(
  () => nodeFsStateStorage({ dir: "./.persist" }),
  serovalCodec(),
);
```

No optional peer — uses `node:fs`.

## Common mistakes

- **Expecting a `create*Storage` PersistStorage factory.**
- **Assuming sanitize alone makes unique paths** — the hash suffix is required for collisions.
- **Path-traversal keys** — refused after sanitize.

## API surface

- `nodeFsStateStorage({ dir }) → StateStorage<string>`

See also: `persist-seroval`; `persist`.
