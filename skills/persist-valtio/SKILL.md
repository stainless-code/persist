---
name: persist-valtio
description: Persist a valtio proxy object with @stainless-code/persist (persistProxy). Use when wiring valtio state to localStorage/sessionStorage/IndexedDB via snapshot/subscribe.
license: MIT
metadata:
  type: composition
  library: "@stainless-code/persist"
  library_version: "0.4.0"
  framework: "valtio"
sources:
  - stainless-code/persist:src/adapters/sources/valtio.ts
  - stainless-code/persist:docs/architecture.md
---

# Persisting valtio

`@stainless-code/persist/sources/valtio` maps a **proxy object** through `snapshot` / `Object.assign` / `subscribe` (`valtio/vanilla`) onto `persistSource`.

## When to use this skill

- You have a `proxy({…})` object state and want it to survive reload.
- State is an **object** (not a primitive proxy target).

## Install

```bash
bun add @stainless-code/persist valtio
```

`valtio` is an optional peer of `/sources/valtio`.

## Minimal wiring

```ts
import { proxy } from "valtio";
import { createJSONStorage } from "@stainless-code/persist";
import { persistProxy } from "@stainless-code/persist/sources/valtio";

const prefs = proxy({ theme: "light" as const });
const persist = persistProxy(prefs, {
  name: "app:prefs:v1",
  storage: createJSONStorage(() => localStorage),
});
```

## Hydrate semantics

Writes apply with `Object.assign(proxy, next)` — keys **absent** from `next` are not deleted. Design `partialize` / migrate so hydrate payloads carry the shape you need, or reset keys yourself.

## Common mistakes

- **Persisting a non-object.** `TState extends object`.
- **Expecting deep replace / key deletion** on hydrate via assign alone.
- **Forgetting `destroy()`** for non-singleton proxies.

## API surface

- `persistProxy(proxyObject, options) → PersistApi`
- Options / `PersistApi`: same as `persistSource`

See also: `persist-mobx` — same object + assign pattern with `runInAction`.
