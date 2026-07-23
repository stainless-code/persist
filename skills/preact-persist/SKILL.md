---
name: preact-persist
description: Gate Preact UI on Persist hydration with useHydrated (preact/compat useSyncExternalStore). Use when avoiding flash of default state on async backends or wiring HydrationSignal into Preact.
license: MIT
metadata:
  type: framework
  library: "@stainless-code/persist"
  library_version: "0.4.0"
  framework: "preact"
requires:
  - persist
sources:
  - stainless-code/persist:src/adapters/frameworks/preact.ts
---

# Preact hydration gate

`@stainless-code/persist/frameworks/preact` mirrors the React adapter via `preact/compat` `useSyncExternalStore` (SSR snapshot always `true`). Not a state source — pair with a `./sources/*` adapter.

## Install

```bash
bun add @stainless-code/persist preact
```

Peer: `preact` `>=10.19.0`.

## Minimal wiring

```tsx
import { useHydrated } from "@stainless-code/persist/frameworks/preact";

const { hydrated } = useHydrated(prefsHydration);
if (!hydrated) return <Skeleton />;
return <PrefsView />;
```

`prefsHydration = toHydrationSignal(persist)` from your store module.

## Common mistakes

- **Importing `/frameworks/react` in a Preact app.** Use this subpath.
- **Treating the hook as state.** Read the store separately.
- **Null signal ≠ loading** — means no persist → hydrated.

## API surface

- `useHydrated(signal) → { hydrated: boolean }`

See also: `react-persist` (same contract).
