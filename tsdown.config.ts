import { defineConfig } from "tsdown";

const outDir = "dist";

// Five subpath entries — each maps 1:1 to an `exports` entry. The core
// (`index`) re-exports `persist-core` + `hydration`; the others own their
// optional peer deps, which stay external so consumers tree-shake cleanly.
export default defineConfig({
  entry: [
    "src/index.ts",
    "src/persist-seroval.ts",
    "src/persist-idb.ts",
    "src/persist-crosstab.ts",
    "src/persist-zod.ts",
    "src/persist-tanstack.ts",
    "src/use-hydrated.ts",
  ],
  outDir,
  format: "esm",
  dts: true,
  // Each subpath owns its peer dep — never bundle them into dist.
  deps: {
    neverBundle: ["seroval", "idb-keyval", "@tanstack/store", "react", "zod"],
  },
  clean: true,
});
