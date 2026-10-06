import { defineConfig } from "blume";
import { orama } from "blume/search";
import { filesystem, githubReleases } from "blume/sources";

import { CURATED_POPULAR } from "./components/curated-popular";

const title = "Persist";
/** Custom `.astro` pages have no frontmatter — name OG cards (else humanized segment). */
const homeTitle = `${title} — any store, any storage, one middleware`;
const notFoundTitle = "Page not found";

/** GitHub owner + repo — shared by `github` and the releases source. */
const owner = "stainless-code";
const repo = "persist";

export default defineConfig({
  title,
  description:
    "Hydration-aware persistence for any reactive store — zero-dep persistSource core; codecs, backends, cross-tab transport, and source + framework adapters ship as opt-in subpaths",

  logo: { image: "/logo.svg", text: title },

  github: {
    owner,
    repo,
    branch: "main",
    dir: "apps/docs",
  },

  lastModified: "git",

  variables: {
    pkg: "@stainless-code/persist",
  },

  content: {
    sources: [
      filesystem({ root: "content" }),
      githubReleases({
        prefix: "changelog",
        owner,
        repo,
        limit: 100,
      }),
    ],
  },

  navigation: {
    tabs: [
      { label: "Guides", path: "/guides" },
      { label: "Recipes", path: "/recipes" },
      { label: "Concepts", path: "/concepts" },
      { label: "Adapters", path: "/adapters" },
      { label: "Reference", path: "/reference" },
    ],
    featured: [
      { label: "Changelog", href: "/changelog", icon: "sparkles" },
      {
        label: "GitHub",
        href: `https://github.com/${owner}/${repo}`,
        icon: "github",
      },
    ],
    sidebar: { display: "flat" },
  },

  // Built-in footer for docs pages; the homepage slots its own Footer.
  footer: {
    links: [
      { label: "Getting started", href: "/guides/getting-started" },
      { label: "Guides", href: "/guides" },
      { label: "Concepts", href: "/concepts" },
      { label: "Recipes", href: "/recipes" },
      { label: "Changelog", href: "/changelog" },
    ],
    socials: {
      github: `https://github.com/${owner}/${repo}`,
    },
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
    provider: orama(),
    // Cmd+K empty-state + shared with 404 via CURATED_POPULAR.
    popular: CURATED_POPULAR.map(({ route, label }) => ({
      href: route,
      label,
    })),
  },

  markdown: {
    externalLinks: true,
    code: {
      icons: true,
      theme: { light: "github-light", dark: "github-dark" },
    },
  },

  toc: { minHeadingLevel: 2, maxHeadingLevel: 3 },

  export: { epub: true, pdf: true },

  agents: {
    llmsTxt: true,
    agentReadability: true,
  },

  seo: {
    og: {
      enabled: true,
      titles: { "/": homeTitle, "/404": notFoundTitle },
    },
    rss: { enabled: true, types: ["changelog"] },
    sitemap: true,
    robots: true,
    structuredData: true,
  },

  deployment: {
    site: "https://stainless-code.com",
    base: "/persist",
  },
});
