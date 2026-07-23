---
name: persist-async-storage
description: Persist with React Native AsyncStorage via @stainless-code/persist/backends/async-storage. Use for RN string-wire JSON state; always gate with useHydrated.
license: MIT
metadata:
  type: composition
  library: "@stainless-code/persist"
  library_version: "0.4.0"
  framework: "@react-native-async-storage/async-storage"
requires:
  - persist
sources:
  - stainless-code/persist:src/adapters/backends/async-storage.ts
---

# AsyncStorage backend

JSON via `createJSONStorage` under the hood. Fully **async** → **`useHydrated` mandatory**. Factory does **not** accept `clearCorruptOnFailure` — use `createStorage(() => asyncStorageStateStorage(), jsonCodec(), opts)` when you need it.

## Install

```bash
bun add @stainless-code/persist @react-native-async-storage/async-storage
```

Peer: `@react-native-async-storage/async-storage` `>=1.0.0`.

## Minimal wiring

```ts
import { createAsyncStorage } from "@stainless-code/persist/backends/async-storage";

const storage = createAsyncStorage<Prefs>()!;
```

Optional custom instance for namespacing: `createAsyncStorage(myAsyncStorage)`.

## Common mistakes

- **Treating hydrate as sync.**
- **Expecting Set/Map/Date** — use seroval compose or avoid.
- **Passing `clearCorruptOnFailure` to the factory.**

## API surface

- `createAsyncStorage(storage?)` · `asyncStorageStateStorage(storage?)`

See also: `persist-mmkv` (sync RN).
