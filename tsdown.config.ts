import { defineConfig } from "tsdown";

const outDir = "dist";

// Subpath entries — each maps 1:1 to an `exports` entry and mirrors
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
    "backends/encrypted": "src/adapters/backends/encrypted.ts",
    "backends/compressed": "src/adapters/backends/compressed.ts",
    "backends/node-fs": "src/adapters/backends/node-fs.ts",
    "transport/crosstab": "src/adapters/transport/crosstab.ts",
    "sources/tanstack-store": "src/adapters/sources/tanstack-store.ts",
    "sources/zustand": "src/adapters/sources/zustand.ts",
    "sources/jotai": "src/adapters/sources/jotai.ts",
    "sources/valtio": "src/adapters/sources/valtio.ts",
    "sources/mobx": "src/adapters/sources/mobx.ts",
    "sources/pinia": "src/adapters/sources/pinia.ts",
    "sources/redux": "src/adapters/sources/redux.ts",
    "frameworks/react": "src/adapters/frameworks/react.ts",
    "frameworks/solid": "src/adapters/frameworks/solid.ts",
    "frameworks/vue": "src/adapters/frameworks/vue.ts",
    "frameworks/lit": "src/adapters/frameworks/lit.ts",
    "frameworks/alpine": "src/adapters/frameworks/alpine.ts",
    "frameworks/svelte": "src/adapters/frameworks/svelte.ts",
    "frameworks/svelte-store": "src/adapters/frameworks/svelte-store.ts",
    "frameworks/angular": "src/adapters/frameworks/angular.ts",
    "frameworks/preact": "src/adapters/frameworks/preact.ts",
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
      "@angular/core",
      "preact",
      "vue",
      "lit",
      "alpinejs",
      "@react-native-async-storage/async-storage",
      "react-native-mmkv",
      "expo-secure-store",
      "zustand",
      "jotai",
      "valtio",
      "mobx",
      "pinia",
      "redux",
    ],
  },
  clean: true,
});
