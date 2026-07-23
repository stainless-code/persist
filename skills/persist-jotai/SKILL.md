---
name: persist-jotai
description: Persist a jotai WritableAtom via createStore with @stainless-code/persist (persistAtom). Use when wiring jotai atoms to localStorage/sessionStorage/IndexedDB, or when default replace-merge for primitive atoms matters.
license: MIT
metadata:
  type: composition
  library: "@stainless-code/persist"
  library_version: "0.4.0"
  framework: "jotai"
sources:
  - stainless-code/persist:src/adapters/sources/jotai.ts
  - stainless-code/persist:docs/architecture.md
---

# Persisting jotai

`@stainless-code/persist/sources/jotai` persists a **WritableAtom** through a jotai **Store** (`createStore()` → `{ get, set, sub }`).

## When to use this skill

- You own a writable jotai atom and a store, and want reload survival.
- Atom values may be primitives — default merge must **replace**, not shallow-spread.

Zustand / TanStack Store → those `persist-*` skills. Hand-rolled → `persistSource`.

## Install

```bash
bun add @stainless-code/persist jotai
```

`jotai` is an optional peer of `/sources/jotai`.

## Minimal wiring

```ts
import { atom, createStore } from "jotai";
import { createJSONStorage } from "@stainless-code/persist";
import { persistAtom } from "@stainless-code/persist/sources/jotai";

const themeAtom = atom<"light" | "dark">("light");
const store = createStore();
const persist = persistAtom(store, themeAtom, {
  name: "app:theme:v1",
  storage: createJSONStorage(() => localStorage),
});
```

Needs **both** `store` and `atom`. Provider-only / atom-without-store is not enough.

## Replace-merge default

Default `merge` is `(persisted) => persisted`. Shallow-spreading a primitive corrupts it (`{...number}` → `{}`). Pass your own `merge` for object atoms that need spread-merge. Override uses `??`, so `merge: undefined` still replace-merges.

## Common mistakes

- **Omitting `createStore`.** `persistAtom(store, atom, opts)` — store first.
- **Readonly / computed atoms.** Typed as `WritableAtom` only — **no** runtime throw (unlike TanStack `persistAtom`).
- **Assuming object shallow-merge.** Primitives need replace (the default).

## API surface

- `persistAtom(store, atom, options) → PersistApi`
- Options / `PersistApi`: see skill `persist`. Replace-merge also used by TanStack `persistAtom` (`persist-tanstack-store`).
