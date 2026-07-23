---
name: persist-alpine
description: Gate Alpine.js UI on Persist hydration via Alpine.plugin(persist) and useHydrated / $hydrated magic. Use when wiring HydrationSignal into Alpine data components.
license: MIT
metadata:
  type: framework
  library: "@stainless-code/persist"
  library_version: "0.4.0"
  framework: "alpine"
requires:
  - persist-core
sources:
  - stainless-code/persist:src/adapters/frameworks/alpine.ts
---

# Alpine hydration gate

This skill builds on `persist-core`. Read it first for `toHydrationSignal`.

`@stainless-code/persist/frameworks/alpine` is **plugin-first**: `Alpine.plugin(persist)` registers `$hydrated` and enables reactive `useHydrated`. Call `destroy()` from `Alpine.data` teardown.

## Install

```bash
bun add @stainless-code/persist alpinejs
```

Peer: `alpinejs` `>=3.0.0` (types via `@types/alpinejs` — package ships none).

## Minimal wiring

```ts
import Alpine from "alpinejs";
import persist, {
  useHydrated,
} from "@stainless-code/persist/frameworks/alpine";

Alpine.plugin(persist);

Alpine.data("prefs", () => {
  const hydration = useHydrated(prefsHydration);
  return {
    get hydrated() {
      return hydration.hydrated;
    },
    destroy() {
      hydration.destroy();
    },
  };
});
```

Template: `x-show="hydrated"` / `$hydrated` magic (cached per element).

## Common mistakes

- **Skipping `Alpine.plugin(persist)`.** `useHydrated` falls back to a plain object + one-time non-prod warn.
- **Not forwarding `destroy()`** from `Alpine.data`.
- **Stacking manual `$hydrated` subscriptions** — magic already caches per element.

## API surface

- default/`persist(Alpine)` — plugin
- `useHydrated(signal) → { hydrated; destroy() }`

See also: `persist-core`.
