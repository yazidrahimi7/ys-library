/*
  ============================================================
  GET /api/thumb?id=<notion row id> — the image for one card.
  ============================================================
  1. Row has a "thumbnail" link   → send the visitor there.
  2. Row has a "screenshot" file  → serve it from Notion.
  3. Neither                      → capture a screenshot of the website,
                                    save it in Notion, then serve it.
  So each website is captured only once.

  Vercel caches the image for a day, so Notion isn't asked on every
  visit. (Notion's own file links expire after about an hour, which is
  why the image is served through here instead of linked directly.)

  The Notion integration needs the "Update content" and "Insert content"
  capabilities to save screenshots.
*/

import { fetchRow, saveScreenshot } from "../lib/notion.js";
import { captureScreenshot, downloadImage } from "../lib/screenshot.js";

// Notion's upload limit on free workspaces
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export default async function handler(req, res) {
  const id = String(req.query.id || "");
  const notion = { token: process.env.NOTION_TOKEN };
  const databaseId = String(process.env.NOTION_DATABASE_ID || "").replace(/-/g, "");

  // Only Notion page ids are accepted
  if (!/^[0-9a-f]{8}-?([0-9a-f]{4}-?){3}[0-9a-f]{12}$/i.test(id)) {
    return fail(res, 400, "Bad id");
  }

  try {
    const row = await fetchRow(notion, id);

    // Only published cards from our own database
    if (row.databaseId !== databaseId || !row.published || !row.url) {
      return fail(res, 404, "Not found");
    }

    // 1. A thumbnail link set in Notion wins
    if (row.thumbnail) {
      res.setHeader("Cache-Control", "public, s-maxage=3600");
      return res.redirect(302, row.thumbnail);
    }

    // 2. Saved screenshot, or 3. capture one now and save it
    let image;
    if (row.screenshotUrl) {
      image = await downloadImage(row.screenshotUrl);
    } else {
      image = await captureScreenshot(row.url);
      if (image.bytes.length <= MAX_UPLOAD_BYTES) {
        await saveScreenshot(notion, id, image);
      } else {
        console.warn(`Screenshot too big to save in Notion (${image.bytes.length} bytes): ${row.url}`);
      }
    }

    res.setHeader("Content-Type", image.contentType);
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    res.status(200).send(Buffer.from(image.bytes));
  } catch (err) {
    console.error(err);
    fail(res, 502, "Could not load image");
  }
}

// Errors aren't cached, so the next visit tries again
function fail(res, status, message) {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json({ error: message });
}
