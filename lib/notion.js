/*
  ============================================================
  NOTION — talks to the "library CMS" database.
  ============================================================
  Used by:
    - api/cards.js            (live cards, on Vercel)
    - api/submit.js           (visitor submissions, on Vercel)
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

const NOTION_VERSION = "2022-06-28";

// Send one request to the Notion API and return the JSON reply.
async function notion(path, { token, method = "GET", body } = {}) {
  if (!token) throw new Error("Missing NOTION_TOKEN");
  const res = await fetch(`https://api.notion.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: body && JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Notion API ${res.status}: ${await res.text()}`);
  return res.json();
}

/* ---------- Reading cards ---------- */

// Returns every published card, sorted by "order".
export async function fetchPublishedCards({ token, databaseId }) {
  if (!databaseId) throw new Error("Missing NOTION_DATABASE_ID");

  const pages = [];
  let cursor;
  do {
    const data = await notion(`databases/${databaseId}/query`, {
      token,
      method: "POST",
      body: {
        filter: { property: PROPS.published, checkbox: { equals: true } },
        sorts: [{ property: PROPS.order, direction: "ascending" }],
        start_cursor: cursor,
        page_size: 100,
      },
    });
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

/* ---------- Submissions ---------- */

// The tag names in the "type" column, e.g. ["Web", "Mobile", ...].
// Submissions may only use these, so visitors can't create new tags.
export async function fetchTypeNames({ token, databaseId }) {
  const db = await notion(`databases/${databaseId}`, { token });
  return (db.properties[PROPS.type]?.multi_select?.options || []).map((o) => o.name);
}

// Adds a new row with "Published" unchecked, so you can review it first.
export async function createSubmission({ token, databaseId }, s) {
  const text = (content) => [{ type: "text", text: { content } }];
  const properties = {
    [PROPS.title]: { title: text(s.title) },
    [PROPS.url]: { url: s.url },
    [PROPS.description]: { rich_text: s.description ? text(s.description) : [] },
    [PROPS.type]: { multi_select: [{ name: s.type }] },
    [PROPS.published]: { checkbox: false },
  };
  if (s.thumbnail) properties[PROPS.thumbnail] = { url: s.thumbnail };

  await notion("pages", {
    token,
    method: "POST",
    body: { parent: { database_id: databaseId }, properties },
  });
}
