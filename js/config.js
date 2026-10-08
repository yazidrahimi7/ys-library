/*
  ============================================================
  CONFIG — edit this file to change the site's text and categories.
  ============================================================

  - Add / rename / remove categories in `groups` below.
  - `id` is used internally to tag saved links. Keep it short, lowercase,
    no spaces. If you rename an `id`, links already saved under the old
    id will no longer show up in that category.
  - `title` is the big heading shown above the cards for that category.
    If you leave it out, the category name is used instead.
*/

window.LIBRARY_CONFIG = {
  siteName: "Library",

  footer: {
    heading: "Know a great design website?",
    text: "Help the community discover outstanding design inspiration by submitting your favorite website",
    credit: "Designed and built by Yazid",
    linkLabel: "Visit yazidrahimi.com",
    linkUrl: "https://yazidrahimi.com",
  },

  groups: [
    {
      name: "Inspirations",
      categories: [
        { id: "web", name: "Web", title: "UI/UX Inspo" },
        { id: "mobile", name: "Mobile", title: "Mobile Inspo" },
        { id: "video", name: "Video" },
        { id: "portfolio", name: "Portfolio" },
      ],
    },
    {
      name: "Design",
      categories: [
        { id: "colors", name: "Colors" },
        { id: "icons", name: "Icons" },
        { id: "typography", name: "Typography" },
        { id: "branding", name: "Branding" },
      ],
    },
    {
      name: "Tools",
      categories: [
        { id: "tools", name: "Tools & resources" },
        { id: "figma", name: "Figma" },
        { id: "framer", name: "Framer" },
        { id: "ai", name: "AI" },
      ],
    },
    {
      name: "Build",
      categories: [
        { id: "development", name: "Development" },
        { id: "design-system", name: "Design system" },
      ],
    },
    {
      name: "Learn",
      categories: [{ id: "ux", name: "UX" }],
    },
  ],
};
