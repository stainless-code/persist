// Lit hydration adapter — peer `lit` >=3.0.0.
import type { ReactiveController, ReactiveControllerHost } from "lit";

import type { HydrationSignal } from "../../core/hydration";

/**
 * Lit `ReactiveController` that mounts a `HydrationSignal` and exposes
 * `hydrated` for template gating. Construct on the host (calls
 * `host.addController(this)`); subscribe on `hostConnected`, tear down on
 * `hostDisconnected`. Null/undefined signal → `hydrated` stays `true` (no
 * subscribe). Same SSR policy as React: treat as hydrated when there is no
 * signal / nothing to gate server-side.
 *
 * @example
 * ```ts
 * import { LitElement, html } from "lit";
 * import { HydrationController } from "@stainless-code/persist/frameworks/lit";
 *
 * class PrefsEl extends LitElement {
 *   #hydration = new HydrationController(this, prefsHydration);
 *   render() {
 *     return this.#hydration.hydrated
 *       ? html`<prefs-panel></prefs-panel>`
 *       : html`<skeleton-el></skeleton-el>`;
 *   }
 * }
 * ```
 */
export class HydrationController implements ReactiveController {
  readonly #host: ReactiveControllerHost;
  readonly #signal: HydrationSignal | null | undefined;
  #unsubscribe: (() => void) | undefined;

  constructor(
    host: ReactiveControllerHost,
    signal: HydrationSignal | null | undefined,
  ) {
    this.#host = host;
    this.#signal = signal;
    host.addController(this);
  }

  get hydrated(): boolean {
    return this.#signal?.isHydrated() ?? true;
  }

  hostConnected(): void {
    if (!this.#signal) return;
    this.#unsubscribe = this.#signal.subscribeHydrated(() => {
      this.#host.requestUpdate();
    });
    // Hydration may have completed between construct and connect.
    if (this.#signal.isHydrated()) this.#host.requestUpdate();
  }

  hostDisconnected(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
  }
}
