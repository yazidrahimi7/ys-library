/*
  ============================================================
  GET /api/thumb?id=<notion row id> — image for a card with no thumbnail.
  ============================================================
  The site only calls this for cards whose "thumbnail" is empty:
    1. Capture a screenshot of the website (or reuse an old one
       saved in Notion's "screenshot" column).
    2. Save it in the GitHub assets repo (see lib/github.js).
    3. Write its permanent link into the row's "thumbnail" column.
    4. Show the image.
  From then on the card loads the image straight from that link,
  so each website is captured only once.

  Needs Environment Variables: NOTION_TOKEN, NOTION_DATABASE_ID,
  GITHUB_TOKEN, GITHUB_ASSETS_REPO. The Notion integration needs the
  "Update content" capability.
*/

import { fetchRow, setThumbnail } from "../lib/notion.js";
import { captureScreenshot, downloadImage } from "../lib/screenshot.js";
import { saveImageToGitHub } from "../lib/github.js";

export default async function handler(req, res) {
  const id = String(req.query.id || "");
  const notion = { token: process.env.NOTION_TOKEN };
  const github = { token: process.env.GITHUB_TOKEN, repo: process.env.GITHUB_ASSETS_REPO };
  const databaseId = String(process.env.NOTION_DATABASE_ID || "").replace(/-/g, "");

  // Only Notion page ids are accepted
  if (!/^[0-9a-f]{8}-?([0-9a-f]{4}-?){3}[0-9a-f]{12}$/i.test(id)) {
    return fail(res, 400, "Bad id");
  }
  // Check settings first, so a screenshot isn't captured just to be thrown away
  if (!github.token || !github.repo) {
    console.error("Missing GITHUB_TOKEN or GITHUB_ASSETS_REPO");
    return fail(res, 500, "Image storage isn't set up");
  }

  try {
    const row = await fetchRow(notion, id);

    // Only published cards from our own database
    if (row.databaseId !== databaseId || !row.published || !row.url) {
      return fail(res, 404, "Not found");
    }

    // Already has an image link (set by you, or saved earlier) → go there
    if (row.thumbnail) {
      res.setHeader("Cache-Control", "public, s-maxage=300");
      return res.redirect(302, row.thumbnail);
    }

    const image = row.oldScreenshotUrl
      ? await downloadImage(row.oldScreenshotUrl)
      : await captureScreenshot(row.url);

    const link = await saveImageToGitHub(github, fileName(row), image);
    await setThumbnail(notion, id, link);

    // Short cache: the card will use the GitHub link from now on anyway
    res.setHeader("Content-Type", image.contentType);
    res.setHeader("Cache-Control", "public, s-maxage=300");
    res.status(200).send(Buffer.from(image.bytes));
  } catch (err) {
    console.error(err);
    fail(res, 502, "Could not load image");
  }
}

// e.g. "fast-com" from https://www.fast.com
function fileName(row) {
  try {
    return new URL(row.url).hostname.replace(/^www\./, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  } catch {
    return "site";
  }
}

// Errors aren't cached, so the next visit tries again
function fail(res, status, message) {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json({ error: message });
}
