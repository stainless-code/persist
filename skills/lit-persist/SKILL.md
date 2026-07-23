---
name: lit-persist
description: Gate Lit element UI on Persist hydration with HydrationController. Use when wiring HydrationSignal into a ReactiveControllerHost; not a hook.
license: MIT
metadata:
  type: framework
  library: "@stainless-code/persist"
  library_version: "0.4.0"
  framework: "lit"
requires:
  - persist
sources:
  - stainless-code/persist:src/adapters/frameworks/lit.ts
---

# Lit hydration gate

`@stainless-code/persist/frameworks/lit` exports `HydrationController` — a `ReactiveController`, not a hook. Constructor calls `host.addController(this)`; subscribes on `hostConnected`, tears down on `hostDisconnected`.

## Install

```bash
bun add @stainless-code/persist lit
```

Peer: `lit` `>=3.0.0`.

## Minimal wiring

```ts
import { LitElement, html } from "lit";
import { HydrationController } from "@stainless-code/persist/frameworks/lit";

class PrefsEl extends LitElement {
  #hydration = new HydrationController(this, prefsHydration);

  render() {
    return this.#hydration.hydrated
      ? html`<prefs-panel></prefs-panel>`
      : html`<skeleton-el></skeleton-el>`;
  }
}
```

## Common mistakes

- **Inventing `useHydrated` for Lit.** Use the controller.
- **Caching `hydrated` outside render** — the controller already `requestUpdate`s on connect/change; read the getter in `render()`.
- **Null signal ≠ loading** → `hydrated` true, no subscribe.

## API surface

- `new HydrationController(host, signal)` — getter `hydrated: boolean`
