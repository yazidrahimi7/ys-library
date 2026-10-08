/*
  ============================================================
  THUMBNAILS — give a card without an image its screenshot.
  ============================================================
  Used by api/thumb.js (when a visitor sees the card) and
  api/recapture.js (daily, for cards still missing an image).

    1. Skip if today's screenshots are used up (see lib/quota.js).
    2. Capture the website (or reuse an old screenshot from Notion).
    3. Save it in the GitHub assets repo.
    4. Write its link into the row's "thumbnail" column in Notion.
*/

import { setThumbnail } from "./notion.js";
import { captureScreenshot, downloadImage, getLatestQuota, QuotaError } from "./screenshot.js";
import { saveImageToGitHub } from "./github.js";
import { readQuota, saveQuota } from "./quota.js";

export { QuotaError };

// The settings each step needs, from Vercel's Environment Variables
export function settings() {
  return {
    notion: { token: process.env.NOTION_TOKEN },
    github: { token: process.env.GITHUB_TOKEN, repo: process.env.GITHUB_ASSETS_REPO },
  };
}

// Returns { image, link }. Throws QuotaError when no screenshots are left.
export async function makeThumbnail({ notion, github }, pageId, row) {
  let image;
  if (row.oldScreenshotUrl) {
    image = await downloadImage(row.oldScreenshotUrl);   // no screenshot needed
  } else {
    const quota = await readQuota(github);
    if (quota.out) throw new QuotaError("Daily screenshot limit reached");
    try {
      image = await captureScreenshot(row.url);
    } finally {
      // Remember what's left, even if the capture failed
      const latest = getLatestQuota();
      if (latest) await saveQuota(github, latest).catch((e) => console.error(e));
    }
  }

  const link = await saveImageToGitHub(github, fileName(row.url), image);
  await setThumbnail(notion, pageId, link);
  return { image, link };
}

// e.g. "fast-com" from https://www.fast.com
function fileName(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  } catch {
    return "site";
  }
}
