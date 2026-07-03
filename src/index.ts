// Package entry point — re-exports the zero-dep core (`persist-core`) plus
// the framework-agnostic hydration signal (`hydration`). Subpath entries
// (`./seroval`, `./idb`, `./tanstack-store`, `./react`) own their optional
// peers; this core entry stays dependency-free.
export * from "./persist-core";
export * from "./hydration";
