---
name: persist-pinia
description: Persist a Pinia store instance with @stainless-code/persist (persistStore). Use when wiring Pinia option/setup stores to localStorage/sessionStorage/IndexedDB; hydrate replaces $state (not $patch).
license: MIT
metadata:
  type: composition
  library: "@stainless-code/persist"
  library_version: "0.4.0"
  framework: "pinia"
sources:
  - stainless-code/persist:src/adapters/sources/pinia.ts
  - stainless-code/persist:docs/architecture.md
---

# Persisting Pinia

`@stainless-code/persist/sources/pinia` maps a **store instance** onto `persistSource`. Hydrate assigns **`$state`** (full replace). Subscribe uses `$subscribe(…, { detached: true })` so the listener survives Vue `effectScope` stop.

## When to use this skill

- You have `const store = useX()` and want reload survival for option or setup stores.
- You need Persist's gate / codecs / cross-tab instead of (or beside) pinia-plugin-persistedstate.

## Install

```bash
bun add @stainless-code/persist pinia
```

`pinia` is an optional peer of `/sources/pinia` (Vue app + `createPinia()` still required by Pinia).

## Minimal wiring

```ts
import { defineStore } from "pinia";
import { createJSONStorage } from "@stainless-code/persist";
import { persistStore } from "@stainless-code/persist/sources/pinia";

const usePrefs = defineStore("prefs", {
  state: () => ({ theme: "light" as const }),
});

const store = usePrefs(); // instance, after pinia is active
const persist = persistStore(store, {
  name: "app:prefs:v1",
  storage: createJSONStorage(() => localStorage),
});
```

## Common mistakes

- **Passing `defineStore(...)` / the factory** instead of `usePrefs()` instance.
- **Expecting `$patch` semantics on hydrate.** Persist replaces `$state`.
- **Name clash with Redux `persistStore`.** Import from `/sources/pinia` (or alias).
- **Call before `setActivePinia` / app.use(pinia).** Same as any Pinia store use.

## API surface

- `persistStore(store, options) → PersistApi` — `store` is a Pinia `Store`
- Options / `PersistApi`: same as `persistSource`

See also: `persist-react` / Vue hydration adapters for UI gating on async backends.
