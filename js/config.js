/*
  ============================================================
  CONFIG — edit this file to change the site's text and categories.
  ============================================================

  - Add / rename / remove categories in `groups` below.
  - A category's `name` must match a "type" tag in the Notion database
    exactly (e.g. "Web"), or its cards won't show up there.
  - `id` is used in the page address (#web). Keep it short, lowercase,
    no spaces.
  - `open: true` shows a group expanded when the page loads.
*/

window.LIBRARY_CONFIG = {
  siteName: "Library",

  searchPlaceholder: 'Try "dark designs"',

  // The card at the bottom of the sidebar
  promo: {
    heading: "Have a nice idea?",
    text: "Submit here",
  },

  groups: [
    {
      name: "Inspiration",
      open: true,
      categories: [
        { id: "web", name: "Web" },
        { id: "mobile", name: "Mobile" },
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
      name: "Tools & resource",
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
