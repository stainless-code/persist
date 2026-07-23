---
name: solid-persist
description: Gate Solid UI on Persist hydration with useHydrated (Accessor). Use when avoiding flash of default state on async backends; read hydrated() in reactive scopes.
license: MIT
metadata:
  type: framework
  library: "@stainless-code/persist"
  library_version: "0.4.0"
  framework: "solid"
requires:
  - persist
sources:
  - stainless-code/persist:src/adapters/frameworks/solid.ts
---

# Solid hydration gate

This skill builds on `persist`. Read it first for `toHydrationSignal`.

`@stainless-code/persist/frameworks/solid` returns an `Accessor<boolean>` — call `hydrated()` inside tracking scopes (`createEffect`, JSX, …).

## Install

```bash
bun add @stainless-code/persist solid-js
```

Peer: `solid-js` `>=1.6.0`.

## Minimal wiring

```tsx
import { useHydrated } from "@stainless-code/persist/frameworks/solid";

const hydrated = useHydrated(prefsHydration);
// <Show when={hydrated()} fallback={<Skeleton />}>…</Show>
```

## Common mistakes

- **Using `hydrated` as a boolean** — it's an accessor; call it.
- **Reading outside a reactive scope** — won't update.
- **Null signal ≠ loading** → hydrated true.

## API surface

- `useHydrated(signal) → Accessor<boolean>`

See also: `persist`.
