/*
  ============================================================
  NOTION — reads published cards from the "library CMS" database.
  ============================================================
  Used by:
    - api/cards.js            (live, on Vercel)
    - scripts/sync-notion.mjs (manual, saves data/cms.json)
*/

// Notion column names — change these if you rename a column in Notion.
export const PROPS = {
  title: "title",
  url: "url",
  thumbnail: "thumbnail",
  description: "description",
  type: "type",
  published: "Published",
  order: "order",
};

// Returns every published card, sorted by "order".
export async function fetchPublishedCards({ token, databaseId }) {
  if (!token || !databaseId) {
    throw new Error("Missing NOTION_TOKEN or NOTION_DATABASE_ID");
  }

  const pages = [];
  let cursor;
  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: { property: PROPS.published, checkbox: { equals: true } },
        sorts: [{ property: PROPS.order, direction: "ascending" }],
        start_cursor: cursor,
        page_size: 100,
      }),
    });
    if (!res.ok) throw new Error(`Notion API ${res.status}: ${await res.text()}`);
    const data = await res.json();
    pages.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  // Rows without a title or link can't become a card
  return pages.map(toCard).filter((c) => c.title && c.url);
}

function toCard(page) {
  const p = page.properties;
  const url = p[PROPS.url];
  return {
    id: page.id,
    title: plainText(p[PROPS.title]),
    // "url" may be a URL column or a text column — handle both
    url: url?.type === "url" ? url.url || "" : plainText(url),
    thumbnail: p[PROPS.thumbnail]?.url || "",
    description: plainText(p[PROPS.description]),
    types: (p[PROPS.type]?.multi_select || []).map((t) => t.name),
    order: p[PROPS.order]?.number ?? null,
    createdAt: page.created_time,
  };
}

function plainText(prop) {
  const parts = prop?.title || prop?.rich_text || [];
  return parts.map((p) => p.plain_text).join("").trim();
}
