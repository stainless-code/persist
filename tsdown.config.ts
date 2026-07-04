import { defineConfig } from "tsdown";

const outDir = "dist";

// Fourteen subpath entries — each maps 1:1 to an `exports` entry and mirrors
// the src folder structure: key `<seam>/<name>` → `src/adapters/<seam>/<name>.ts`
// → `dist/<seam>/<name>.mjs` → subpath `./<seam>/<name>`. The core (`core/index`)
// re-exports `persist-core` + `hydration`; the adapters own their optional peer
// deps, which stay external so consumers tree-shake cleanly.
export default defineConfig({
  entry: {
    "core/index": "src/core/index.ts",
    "codecs/seroval": "src/adapters/codecs/seroval.ts",
    "codecs/zod": "src/adapters/codecs/zod.ts",
    "backends/idb": "src/adapters/backends/idb.ts",
    "backends/async-storage": "src/adapters/backends/async-storage.ts",
    "backends/mmkv": "src/adapters/backends/mmkv.ts",
    "backends/secure-store": "src/adapters/backends/secure-store.ts",
    "transport/crosstab": "src/adapters/transport/crosstab.ts",
    "sources/tanstack-store": "src/adapters/sources/tanstack-store.ts",
    "frameworks/react": "src/adapters/frameworks/react.ts",
    "frameworks/solid": "src/adapters/frameworks/solid.ts",
    "frameworks/vue": "src/adapters/frameworks/vue.ts",
    "frameworks/svelte": "src/adapters/frameworks/svelte.ts",
    "frameworks/svelte-store": "src/adapters/frameworks/svelte-store.ts",
  },
  outDir,
  format: "esm",
  dts: true,
  // Each subpath owns its peer dep — never bundle them into dist.
  deps: {
    neverBundle: [
      "seroval",
      "idb-keyval",
      "@tanstack/store",
      "react",
      "zod",
      "solid-js",
      "svelte",
      "vue",
      "@react-native-async-storage/async-storage",
      "react-native-mmkv",
      "expo-secure-store",
    ],
  },
  clean: true,
});
