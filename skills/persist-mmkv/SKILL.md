---
name: persist-mmkv
description: Persist with react-native-mmkv via @stainless-code/persist/backends/mmkv (createMmkvStorage). Sync JSON string-wire; id required; optional MMKV encryptionKey (≤16 bytes).
license: MIT
metadata:
  type: composition
  library: "@stainless-code/persist"
  library_version: "0.4.0"
  framework: "mmkv"
requires:
  - persist
sources:
  - stainless-code/persist:src/adapters/backends/mmkv.ts
---

# MMKV backend

This skill builds on `persist`.

**Sync** backend — no hydrate UI gate required for flash. JSON string-wire. `id` namespaces the MMKV file. `encryptionKey` is MMKV's own key (max **16 bytes**), not `persist-encrypted`.

## Install

```bash
bun add @stainless-code/persist react-native-mmkv
```

Peer: `react-native-mmkv` `>=4.0.0`.

## Minimal wiring

```ts
import { createMmkvStorage } from "@stainless-code/persist/backends/mmkv";

const storage = createMmkvStorage<Prefs>({ id: "app-prefs" })!;
```

## Common mistakes

- **Gating like IDB** — MMKV is sync.
- **Confusing `encryptionKey` with `backends/encrypted`.**
- **Omitting `id`.**

## API surface

- `createMmkvStorage({ id, path?, encryptionKey? })` · `mmkvStateStorage(instance)`

See also: `persist-async-storage`; `persist-encrypted` for WebCrypto AES-GCM; `persist`.
