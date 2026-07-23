---
name: persist-crosstab
description: Cross-tab sync for backends without storage events via @stainless-code/persist/transport/crosstab (createBroadcastCrossTab). Wrap storage + pass crossTabEventTarget; call close() on teardown.
license: MIT
metadata:
  type: composition
  library: "@stainless-code/persist"
  library_version: "0.4.1"
requires:
  - persist
sources:
  - stainless-code/persist:src/adapters/transport/crosstab.ts
---

# BroadcastChannel cross-tab transport

For backends with **no** `storage` events (IndexedDB). Must **`wrap(storage)`** and pass `crossTabEventTarget` with `crossTab: true`. Posts `storageArea: null` (key-only match — each tab owns its backend instance). Returns `undefined` if `BroadcastChannel` missing. Call `close()` on teardown.

## Install

```bash
bun add @stainless-code/persist idb-keyval @tanstack/store
```

Example peers: `idb-keyval` (IDB backend) + `@tanstack/store` (source). Swap either for your stack.

## Minimal wiring

```ts
import { Store } from "@tanstack/store";
import { createIdbStorage } from "@stainless-code/persist/backends/idb";
import { persistStore } from "@stainless-code/persist/sources/tanstack-store";
import { createBroadcastCrossTab } from "@stainless-code/persist/transport/crosstab";

const store = new Store({ theme: "light" });
const bridge = createBroadcastCrossTab({ channelName: "app:prefs" })!;
const persist = persistStore(store, {
  name: "app:prefs:v1",
  storage: bridge.wrap(createIdbStorage()!),
  crossTab: true,
  crossTabEventTarget: bridge.crossTabEventTarget,
});
// teardown: persist.destroy(); bridge.close();
```

`localStorage` can use `crossTab: true` alone — this bridge is for IDB-like backends.

## Common mistakes

- **`crossTab: true` alone on IDB** — no native events.
- **Forgetting `wrap` or `close`.**
- **Expecting `storageArea` reference equality across tabs.**

## API surface

- `createBroadcastCrossTab({ channelName }) → { crossTabEventTarget, wrap, close } | undefined`

See also: `persist-idb`.
