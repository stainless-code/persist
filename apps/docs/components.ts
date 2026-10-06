import { defineComponents } from "blume";

import Header from "./components/blume/Header.astro";
import Pagination from "./components/blume/Pagination.astro";
import FaqSection from "./components/seo/FaqSection.astro";

export default defineComponents({
  layout: {
    // Forked header: adds a GitHub icon (repoUrl with public-mirror fallback)
    // since Blume moved the repo mark to the footer; text link removed from
    // `navigation.actions` in blume.config.ts.
    Header,
    // No layout.Footer — the homepage slots its custom Footer; docs pages
    // use the built-in footer from `footer` in blume.config.ts.
    // Theme radius (rounded-blume) instead of built-in pill corners.
    Pagination,
  },
  mdx: {
    FaqSection,
  },
});
