/*
  ============================================================
  POST /api/upload — you add an image to the Screenshots gallery.
  ============================================================
  Only for you: the request must include your upload key (the
  UPLOAD_KEY Environment Variable in Vercel). The images go into the
  public GitHub assets repo, so random visitors must not be able to
  add files there.

  Steps: check the key → check the image → save it in the assets repo
  (screenshots/ folder) → add a published row in Notion tagged
  GALLERY_TYPE with the image link in "thumbnail".

  The browser shrinks the image before sending it (see js/app.js),
  because Vercel accepts at most ~4.5 MB per request.
*/

import { timingSafeEqual } from "node:crypto";
import { createImageRow } from "../lib/notion.js";
import { saveImageToGitHub } from "../lib/github.js";

// Must match the gallery category's `name` in js/config.js
// and the "type" tag in Notion
const GALLERY_TYPE = "Screenshots";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const LIMITS = { title: 100, description: 300 };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST" });
  }

  const key = process.env.UPLOAD_KEY;
  if (!key) return res.status(500).json({ error: "Uploads aren't set up (UPLOAD_KEY missing)" });
  if (!sameText(String(req.headers["x-upload-key"] || ""), key)) {
    return res.status(401).json({ error: "Wrong upload key" });
  }

  const body = typeof req.body === "object" && req.body ? req.body : {};
  const image = readImage(body.image);
  if (!image) return res.status(400).json({ error: "Please choose a JPG, PNG or WebP image." });
  if (image.bytes.length > MAX_IMAGE_BYTES) return res.status(400).json({ error: "That image is too large." });

  const str = (v) => (typeof v === "string" ? v.trim() : "");
  const title = str(body.title).replace(/⭐/g, "").trim() || `Screenshot ${new Date().toISOString().slice(0, 10)}`;
  const description = str(body.description);
  if (title.length > LIMITS.title || description.length > LIMITS.description) {
    return res.status(400).json({ error: "The title or description is too long." });
  }

  try {
    const github = { token: process.env.GITHUB_TOKEN, repo: process.env.GITHUB_ASSETS_REPO };
    const imageUrl = await saveImageToGitHub(github, slug(title), image, "screenshots");
    const card = await createImageRow(
      { token: process.env.NOTION_TOKEN, databaseId: process.env.NOTION_DATABASE_ID },
      { title, description, type: GALLERY_TYPE, imageUrl }
    );
    res.status(200).json({ ok: true, card });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "Upload failed. Please try again." });
  }
}

// "data:image/jpeg;base64,..." → { bytes, contentType }, only for real image files
function readImage(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  const type = match[1];
  // Check the file really starts like that kind of image
  const looksRight =
    (type === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8) ||
    (type === "image/png" && bytes.subarray(1, 4).toString() === "PNG") ||
    (type === "image/webp" && bytes.subarray(8, 12).toString() === "WEBP");
  return looksRight ? { bytes: new Uint8Array(bytes), contentType: type } : null;
}

// Compare secrets without leaking how many characters matched
function sameText(a, b) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// "My Screenshot!" → "my-screenshot"
function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "screenshot";
}
