// BroadcastChannel cross-tab bridge — no peer dep (web global, browsers + Node 18+). For backends that fire no `storage` events (IndexedDB).
import type {
  CrossTabEventTarget,
  CrossTabStorageEvent,
  PersistStorage,
} from "../../core/persist-core";

export interface CreateBroadcastCrossTabOptions {
  /** BroadcastChannel name — all tabs sharing this name sync. */
  channelName: string;
}

export interface BroadcastCrossTab<S> {
  /** Pass as `crossTabEventTarget`. Listens for `message` events and dispatches
   *  storage-shaped events (storageArea: null → key-only matching in every tab). */
  crossTabEventTarget: CrossTabEventTarget;
  /** Wrap a base `PersistStorage` so writes/removes broadcast. Pass the result
   *  as `storage`. Preserves `raw`. */
  wrap: (storage: PersistStorage<S>) => PersistStorage<S>;
  /** Close the underlying channel — call from the persist `destroy()` path. */
  close: () => void;
}

/**
 * Bridge a `BroadcastChannel` as the cross-tab transport for backends that
 * fire no `storage` events (IndexedDB). Posts `storageArea: null` on every
 * event so key-only matching applies in every tab (each tab owns its own
 * backend instance — reference equality on `raw` would fail across tabs).
 *
 * @example
 * ```ts
 * const bridge = createBroadcastCrossTab({ channelName: "app:prefs" })!;
 * const persist = persistStore(store, {
 *   name: "app:prefs:v1",
 *   storage: bridge.wrap(createIdbStorage()!),
 *   crossTab: true,
 *   crossTabEventTarget: bridge.crossTabEventTarget,
 * });
 * // on teardown: persist.destroy(); bridge.close();
 * ```
 */
export function createBroadcastCrossTab<S>(
  options: CreateBroadcastCrossTabOptions,
): BroadcastCrossTab<S> | undefined {
  if (typeof BroadcastChannel === "undefined") {
    return undefined;
  }

  const channel = new BroadcastChannel(options.channelName);
  const handlerMap = new Map<
    (event: CrossTabStorageEvent) => void,
    (event: MessageEvent) => void
  >();

  const crossTabEventTarget: CrossTabEventTarget = {
    addEventListener(_type, listener) {
      const handler = (event: MessageEvent) => {
        listener(event.data as CrossTabStorageEvent);
      };
      handlerMap.set(listener, handler);
      channel.addEventListener("message", handler);
    },
    removeEventListener(_type, listener) {
      const handler = handlerMap.get(listener);
      if (handler) {
        channel.removeEventListener("message", handler);
        handlerMap.delete(listener);
      }
    },
  };

  function postMessage(message: CrossTabStorageEvent) {
    try {
      channel.postMessage(message);
    } catch {
      // closed channel — swallow so a settled write microtask doesn't throw
    }
  }

  return {
    crossTabEventTarget,
    wrap(storage) {
      return {
        getItem: (name) => storage.getItem(name),
        raw: storage.raw,
        setItem(name, value) {
          const result = storage.setItem(name, value);
          Promise.resolve(result).then(() => {
            postMessage({
              key: name,
              newValue: 1 as unknown as string,
              storageArea: null,
            });
          });
          return result;
        },
        removeItem(name) {
          const result = storage.removeItem(name);
          Promise.resolve(result).then(() => {
            postMessage({ key: name, newValue: null, storageArea: null });
          });
          return result;
        },
      };
    },
    close() {
      channel.close();
      handlerMap.clear();
    },
  };
}
