// Lit hydration adapter — peer `lit` >=3.0.0.
import type { ReactiveController, ReactiveControllerHost } from "lit";

import type { HydrationSignal } from "../../core/hydration";

/**
 * Lit `ReactiveController` over `HydrationSignal` — gate with `hydrated`.
 * Construct on the host (`addController`); subscribe on connect, tear down on
 * disconnect. Null signal → `hydrated` stays `true`.
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
    // Pull-model attach: re-read snapshot (covers hydrate-before-connect and
    // reconnect during rehydrate's false window).
    this.#host.requestUpdate();
  }

  hostDisconnected(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
  }
}
