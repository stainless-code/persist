import { defineConfig } from "blume";

import { CURATED_POPULAR } from "./components/curated-popular";

export default defineConfig({
  title: "Persist",
  description:
    "Hydration-aware persistence for any reactive store — zero-dep persistSource core; codecs, backends, cross-tab transport, and source + framework adapters ship as opt-in subpaths",

  logo: { image: "/logo.svg", text: "Persist" },

  github: {
    owner: "stainless-code",
    repo: "persist",
    branch: "main",
    dir: "apps/docs",
  },

  lastModified: true,

  content: {
    sources: [
      { type: "filesystem", root: "content" },
      {
        type: "github-releases",
        prefix: "changelog",
        owner: "stainless-code",
        repo: "persist",
        limit: 100,
      },
    ],
  },

  navigation: {
    tabs: [
      { label: "Guides", path: "/guides", icon: "book-open" },
      { label: "Recipes", path: "/recipes", icon: "flask-conical" },
      { label: "Concepts", path: "/concepts", icon: "lightbulb" },
      { label: "Adapters", path: "/adapters", icon: "puzzle" },
      { label: "Reference", path: "/reference", icon: "code" },
    ],
    featured: [
      { label: "Changelog", href: "/changelog", icon: "sparkles" },
      {
        label: "GitHub",
        href: "https://github.com/stainless-code/persist",
        icon: "github",
      },
    ],
    sidebar: { display: "flat" },
  },

  // Amber-copper brand; theme.css owns full light/dark token map.
  theme: {
    accent: { light: "#b45309", dark: "#fbbf24" },
    background: { light: "#fafafa", dark: "#18181b" },
    radius: "sm",
    mode: "system",
    fonts: {
      display: "inter-tight",
      body: "inter",
      mono: "geist-mono",
    },
  },
  search: {
    provider: "orama",
    // Cmd+K empty-state + shared with 404 via CURATED_POPULAR.
    popular: CURATED_POPULAR.map(({ route, label }) => ({
      href: route,
      label,
    })),
  },

  markdown: {
    code: { icons: true },
    codeBlocks: { theme: { light: "github-light", dark: "github-dark" } },
  },

  toc: { minHeadingLevel: 2, maxHeadingLevel: 3 },

  export: { epub: true, pdf: true },

  ai: {
    llmsTxt: true,
  },

  seo: {
    og: { enabled: true },
    rss: { enabled: true, types: ["changelog"] },
    sitemap: true,
    robots: true,
    structuredData: true,
    agentReadability: true,
  },

  deployment: {
    output: "static",
    site: "https://stainless-code.com",
    base: "/persist",
  },
});
