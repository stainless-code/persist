---
name: alpine-persist
description: Gate Alpine.js UI on Persist hydration (Alpine.plugin + useHydrated / $hydrated). Use when wiring HydrationSignal into Alpine data components.
license: MIT
metadata:
  type: framework
  library: "@stainless-code/persist"
  library_version: "0.4.0"
  framework: "alpine"
requires:
  - persist
sources:
  - stainless-code/persist:src/adapters/frameworks/alpine.ts
---

# Alpine hydration gate

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

Template: `x-show="$hydrated(prefsHydration).hydrated"` — `$hydrated(signal)` returns a **bag** (`{ hydrated, destroy }`), not a boolean (a bare bag is always truthy in `x-show`). Magic caches per element.

## Common mistakes

- **Skipping `Alpine.plugin(persist)`.** `useHydrated` falls back to a plain object + one-time non-prod warn.
- **`x-show="$hydrated(...)"` without `.hydrated`.**
- **Not forwarding `destroy()`** from `Alpine.data`.

## API surface

- default/`persist(Alpine)` — plugin; registers `$hydrated(signal) → HydratedBag`
- `useHydrated(signal) → { hydrated; destroy() }` (null signal → `{ hydrated: true }`)
