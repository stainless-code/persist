---
name: persist-redux
description: Persist a Redux/RTK store with @stainless-code/persist (persistStore + persistableReducer). Use when wrapping the root reducer for hydrate SET actions, or migrating off redux-persist.
license: MIT
metadata:
  type: composition
  library: "@stainless-code/persist"
  library_version: "0.4.1"
  framework: "redux"
sources:
  - stainless-code/persist:src/adapters/sources/redux.ts
  - stainless-code/persist:docs/architecture.md
---

# Persisting Redux / RTK

`@stainless-code/persist/sources/redux` has no native `setState` — hydrate dispatches a private `@stainless-code/persist/SET` action. The **root reducer must** be wrapped with `persistableReducer` so that action replaces state.

## When to use this skill

- Classic `redux` or `@reduxjs/toolkit` `configureStore` / `createStore`.
- Migrating off `redux-persist` while keeping one Persist stack across the app.

## Install

```bash
bun add @stainless-code/persist redux
# and/or
bun add @reduxjs/toolkit
```

`redux` `>=5` is the optional peer (covers classic + RTK stores).

## Minimal wiring

```ts
import { createStore } from "redux";
import { createJSONStorage } from "@stainless-code/persist";
import {
  persistStore,
  persistableReducer,
} from "@stainless-code/persist/sources/redux";

const store = createStore(persistableReducer(rootReducer));
const persist = persistStore(store, {
  name: "app:root:v1",
  storage: createJSONStorage(() => localStorage),
});
```

RTK: pass `reducer: persistableReducer(rootReducer)` (or wrap the combined root) into `configureStore`.

## `persistableReducer` (required)

- Wrap the **root** only — not each slice, not leaves inside `combineReducers`.
- Per-slice wrap corrupts hydrate (payload is the full root state).
- Without the wrap, hydrate no-ops; in DEV Persist `console.warn`s if state identity is unchanged after the SET dispatch.
- Named `persistableReducer` to avoid clashing with redux-persist's `persistReducer`.

## Common mistakes

- **Forgetting `persistableReducer`.** Silent no-op hydrate.
- **Wrapping slices.** Full-state SET payload won't match slice shape.
- **`replaceReducer` for hydrate.** Not the Persist path.
- **Name clash with redux-persist `persistStore`.** Alias one import.

## API surface

- `persistableReducer(baseReducer) → Reducer`
- `persistStore(store, options) → PersistApi`
- Options / `PersistApi`: same as `persistSource`

See also: `persist-zustand` for a store API with native `setState` (no reducer wrap).
