import type { StateStorage } from "../core/persist-core";

/**
 * In-memory `StateStorage` for tests — a `Map`-backed `localStorage` stand-in.
 * Test-only; not a tsdown/typedoc entry, so not shipped in `dist/`.
 */
export class MemoryStorage implements StateStorage {
  private store = new Map<string, string>();

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}
