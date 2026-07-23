---
name: persist-mobx
description: Persist a MobX observable object with @stainless-code/persist (persistObservable). Use when wiring MobX state to localStorage/sessionStorage/IndexedDB under enforceActions.
license: MIT
metadata:
  type: composition
  library: "@stainless-code/persist"
  library_version: "0.4.1"
  framework: "mobx"
sources:
  - stainless-code/persist:src/adapters/sources/mobx.ts
  - stainless-code/persist:docs/architecture.md
---

# Persisting MobX

`@stainless-code/persist/sources/mobx` maps an **observable object** through `toJS` / `runInAction`+`Object.assign` / `observe` onto `persistSource`.

## When to use this skill

- You have `observable.object({…})` (or compatible object observable) and want reload survival.
- You use `configure({ enforceActions: "always" })` — hydrate must run inside an action.

## Install

```bash
bun add @stainless-code/persist mobx
```

`mobx` is an optional peer of `/sources/mobx`.

## Minimal wiring

```ts
import { observable } from "mobx";
import { createJSONStorage } from "@stainless-code/persist";
import { persistObservable } from "@stainless-code/persist/sources/mobx";

const prefs = observable.object({ theme: "light" as const });
const persist = persistObservable(prefs, {
  name: "app:prefs:v1",
  storage: createJSONStorage(() => localStorage),
});
```

## Hydrate semantics

Hydrate uses `runInAction(() => Object.assign(observable, next))`. Bare assign would throw under `enforceActions: "always"`. Keys absent from `next` are not deleted (same as valtio).

## Common mistakes

- **Writing hydrate outside actions** in custom `persistSource` ports — this adapter already wraps `runInAction`.
- **Class instances / primitives** as the persist root — target is an object observable.
- **Expecting deep replace** from `Object.assign` alone.

## API surface

- `persistObservable(observable, options) → PersistApi`
- Options / `PersistApi`: same as `persistSource`

See also: `persist-valtio` — same object + assign hydrate pattern without MobX actions.
