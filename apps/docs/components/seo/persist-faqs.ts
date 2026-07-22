/** Shared FAQ copy — guides/faq body + FAQPage JSON-LD stay in sync. */
export const PERSIST_FAQS = [
  {
    question: "Why does my UI flash?",
    answer:
      "Async backend (IndexedDB, AsyncStorage, SecureStore, Node fs) without a hydration gate. Gate with your framework adapter — [`useHydrated`](/adapters/framework-adapter), `hydratedRune`, or `hydratedStore`. Don't manually defer writes — the middleware already gates them until hydrated; double-gating drops legitimate updates.",
  },
  {
    question: "Why isn't IndexedDB syncing across tabs?",
    answer:
      "IndexedDB fires no `storage` events. Use `@stainless-code/persist/transport/crosstab` (`createBroadcastCrossTab`) as the `crossTabEventTarget` + `bridge.wrap(...)`. See [Cross-tab over IndexedDB](/recipes/crosstab).",
  },
  {
    question: "What do I do when storage quota is exceeded?",
    answer:
      "`retryWrite: ({ state, errorCount }) => ...` — shrink to retry, `undefined` to give up. The write-generation guard ensures stale retries never clobber newer state. See [retryWrite](/recipes/options#retrywrite--shrink-or-give-up-on-quota).",
  },
  {
    question: "Why don't Set / Map / Date round-trip?",
    answer:
      "Use `@stainless-code/persist/codecs/seroval` for string-wire backends, or `@stainless-code/persist/backends/idb` (`createIdbStorage` — structured-clone, no codec). Never pair `identityCodec` with a string-only backend. See [Choosing a codec](/concepts/choosing-codec).",
  },
  {
    question: "How do I clear all persisted keys on logout?",
    answer:
      "`createPersistRegistry()`; pass `registry` to each store; `await registry.clearAll()`. See [Clear-all on logout](/recipes/options#clear-all-on-logout).",
  },
  {
    question: "How do I encrypt at rest?",
    answer:
      "`@stainless-code/persist/backends/encrypted` (`createEncryptedStorage`) — wraps any backend with AES-GCM. See [Recipes](/recipes) for compress-then-encrypt stacks.",
  },
  {
    question: "How do I clean up when the store is not a singleton?",
    answer:
      "`persist.destroy()` on unmount. See [IndexedDB + React, end to end](/guides/idb-react).",
  },
] as const;
