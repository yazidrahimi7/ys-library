/*
  ============================================================
  GET /api/quota — how many free screenshots are left today.
  ============================================================
  Used by the Submit form to show a small warning when screenshots are
  running low or used up (see lib/quota.js).
  Returns { remaining, limit, resetAt, low, out }.
*/

import { readQuota } from "../lib/quota.js";

export default async function handler(req, res) {
  try {
    const quota = await readQuota({ token: process.env.GITHUB_TOKEN, repo: process.env.GITHUB_ASSETS_REPO });
    res.setHeader("Cache-Control", "public, s-maxage=60");
    res.status(200).json(quota);
  } catch (err) {
    console.error(err);
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ error: "Could not read screenshot quota" });
  }
}
