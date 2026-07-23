---
name: persist-secure-store
description: Persist small secrets with Expo SecureStore via @stainless-code/persist/backends/secure-store. ~2KB/key — use partialize; async → useHydrated.
license: MIT
metadata:
  type: composition
  library: "@stainless-code/persist"
  library_version: "0.4.1"
  framework: "expo-secure-store"
requires:
  - persist
sources:
  - stainless-code/persist:src/adapters/backends/secure-store.ts
---

# SecureStore backend

For **tokens / small secrets**, not full app state (~**2KB/key**). Async → gate UI. Keys sanitized to `/^[\w.-]+$/` (`:` → `_`).

## Install

```bash
bun add @stainless-code/persist expo-secure-store zustand
```

Peers: `expo-secure-store` `>=12.0.0`; example uses `zustand` (any `./sources/*` adapter works).

## Minimal wiring

```ts
import { create } from "zustand";
import { createSecureStoreStorage } from "@stainless-code/persist/backends/secure-store";
import { persistStore } from "@stainless-code/persist/sources/zustand";

type Auth = { token: string };
const useAuth = create<Auth>(() => ({ token: "" }));
const storage = createSecureStoreStorage<string>()!;
persistStore(useAuth, {
  name: "auth:token:v1",
  storage,
  partialize: (s) => s.token,
});
```

## Common mistakes

- **Storing large documents** — wrong backend.
- **Skipping `partialize`.**
- **Assuming colon keys are stored literally.**

## API surface

- `createSecureStoreStorage()` · `secureStoreStateStorage()`

See also: `persist-mmkv`; `persist-encrypted`.
