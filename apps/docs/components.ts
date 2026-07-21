import { defineComponents } from "blume";

import Pagination from "./components/blume/Pagination.astro";
import FaqSection from "./components/seo/FaqSection.astro";

export default defineComponents({
  layout: {
    // No layout.Footer — homepage slots it; docs pages stay empty.
    // Theme radius (rounded-blume) instead of built-in pill corners.
    Pagination,
  },
  mdx: {
    FaqSection,
  },
});
