/*
  ============================================================
  POST /api/submit — a visitor suggests a website (Vercel).
  ============================================================
  Adds a row to the Notion database with "Published" unchecked.
  It only shows on the site after you tick "Published" in Notion.

  Needs the same Environment Variables as api/cards.js, and the
  Notion integration must have the "Insert content" capability.
*/

import { createSubmission, fetchTypeNames } from "../lib/notion.js";

// Tags visitors can't choose — only you set these in Notion (lowercase)
const OWNER_ONLY_TYPES = ["featured"];

// Length limits for each field (characters)
const LIMITS = { url: 500, title: 100, description: 300, thumbnail: 500 };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST" });
  }

  const body = typeof req.body === "object" && req.body ? req.body : {};

  // Spam trap: real visitors never see or fill the hidden "company" field.
  // Pretend it worked so bots don't learn anything.
  if (body.company) return res.status(200).json({ ok: true });

  const notion = { token: process.env.NOTION_TOKEN, databaseId: process.env.NOTION_DATABASE_ID };

  try {
    const submission = clean(body);
    if (submission.error) return res.status(400).json({ error: submission.error });

    // Any existing "type" tag except the ones only you should set (e.g. Featured)
    const allowedTypes = (await fetchTypeNames(notion)).filter(
      (t) => !OWNER_ONLY_TYPES.includes(t.toLowerCase())
    );
    if (!allowedTypes.includes(submission.type)) {
      return res.status(400).json({ error: "Please choose a category from the list." });
    }

    await createSubmission(notion, submission);
    res.status(200).json({ ok: true });
  } catch (err) {
    // Log the real reason for Vercel's logs, but don't expose details publicly
    console.error(err);
    res.status(502).json({ error: "Could not send your submission. Please try again later." });
  }
}

// Check and tidy the form fields. Returns { error } if something is wrong.
function clean(body) {
  const str = (v) => (typeof v === "string" ? v.trim() : "");
  const url = str(body.url);
  const thumbnail = str(body.thumbnail);
  // Visitors can't pin their own submission to the top
  const title = str(body.title).replace(/⭐/g, "").trim();
  const description = str(body.description);
  const type = str(body.type);

  if (!isWebLink(url)) return { error: "Please enter a valid website link (https://…)." };
  if (thumbnail && !isWebLink(thumbnail)) return { error: "The image link must start with https://" };
  for (const [field, value] of Object.entries({ url, title, description, thumbnail })) {
    if (value.length > LIMITS[field]) return { error: `The ${field} is too long.` };
  }

  return {
    url,
    title: title || new URL(url).hostname.replace(/^www\./, ""),
    description,
    type,
    thumbnail,
  };
}

function isWebLink(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
