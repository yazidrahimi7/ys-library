/*
  ============================================================
  NOTION — talks to the "library CMS" database.
  ============================================================
  Used by:
    - api/cards.js            (live cards, on Vercel)
    - api/submit.js           (visitor submissions, on Vercel)
    - api/thumb.js            (card images + automatic screenshots, on Vercel)
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
  screenshot: "screenshot",   // "Files & media" column, filled by api/thumb.js
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

/* ---------- Screenshots (used by api/thumb.js) ---------- */

// The parts of one row that api/thumb.js needs.
export async function fetchRow({ token }, pageId) {
  const page = await notion(`pages/${pageId}`, { token });
  const p = page.properties;
  const file = p[PROPS.screenshot]?.files?.[0];
  return {
    databaseId: (page.parent?.database_id || "").replace(/-/g, ""),
    published: p[PROPS.published]?.checkbox === true,
    url: p[PROPS.url]?.url || plainText(p[PROPS.url]),
    thumbnail: p[PROPS.thumbnail]?.url || "",
    // Notion's links to uploaded files expire after about an hour,
    // so this is only used right away, never stored.
    screenshotUrl: file?.file?.url || file?.external?.url || "",
  };
}

// Uploads an image to Notion and puts it in the row's "screenshot" column.
// Uses Notion's File Upload API (max 5 MB per file on free workspaces).
export async function saveScreenshot({ token }, pageId, image) {
  const filename = `screenshot.${image.contentType.split("/")[1] || "png"}`;

  // 1. Start an upload
  const upload = await notion("file_uploads", {
    token,
    method: "POST",
    body: { filename, content_type: image.contentType },
  });

  // 2. Send the file (multipart form, so not through the JSON helper above)
  const form = new FormData();
  form.append("file", new Blob([image.bytes], { type: image.contentType }), filename);
  const sent = await fetch(`https://api.notion.com/v1/file_uploads/${upload.id}/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_VERSION },
    body: form,
  });
  if (!sent.ok) throw new Error(`Notion upload ${sent.status}: ${await sent.text()}`);

  // 3. Attach it to the row
  await notion(`pages/${pageId}`, {
    token,
    method: "PATCH",
    body: {
      properties: {
        [PROPS.screenshot]: {
          files: [{ type: "file_upload", file_upload: { id: upload.id }, name: filename }],
        },
      },
    },
  });
}
