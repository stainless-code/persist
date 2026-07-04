// Package entry point — re-exports the zero-dep core (`persist-core`) plus
// the framework-agnostic hydration signal (`hydration`). Adapter subpaths
// under `../adapters/<seam>/` own their optional peers; this core entry stays
// dependency-free.
export * from "./persist-core";
export * from "./hydration";
