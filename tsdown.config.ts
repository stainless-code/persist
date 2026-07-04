import { defineConfig } from "tsdown";

const outDir = "dist";

// Twelve subpath entries — each maps 1:1 to an `exports` entry. The core
// (`index`) re-exports `persist-core` + `hydration`; the adapters under
// `adapters/<seam>/` own their optional peer deps, which stay external so
// consumers tree-shake cleanly. The record form flattens dist output to
// `dist/<name>.mjs` regardless of the src folder depth.
export default defineConfig({
  entry: {
    index: "src/core/index.ts",
    seroval: "src/adapters/codecs/seroval.ts",
    zod: "src/adapters/codecs/zod.ts",
    idb: "src/adapters/backends/idb.ts",
    "async-storage": "src/adapters/backends/async-storage.ts",
    mmkv: "src/adapters/backends/mmkv.ts",
    "secure-store": "src/adapters/backends/secure-store.ts",
    crosstab: "src/adapters/transport/crosstab.ts",
    "tanstack-store": "src/adapters/sources/tanstack-store.ts",
    react: "src/adapters/frameworks/react.ts",
    solid: "src/adapters/frameworks/solid.ts",
    vue: "src/adapters/frameworks/vue.ts",
    svelte: "src/adapters/frameworks/svelte.ts",
    "svelte-store": "src/adapters/frameworks/svelte-store.ts",
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
