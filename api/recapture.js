/*
  ============================================================
  GET /api/recapture — catch up on missing screenshots (daily).
  ============================================================
  Vercel runs this once a day (see "crons" in vercel.json). It finds
  published cards with an empty "thumbnail" — e.g. ones that came in
  while the daily screenshot limit was used up — and captures them,
  one at a time, until it runs out of screenshots or time.

  Protected by the CRON_SECRET Environment Variable: Vercel sends it
  automatically with each scheduled run, so others can't trigger it.
*/

import { fetchRowsWithoutThumbnail } from "../lib/notion.js";
import { makeThumbnail, settings, QuotaError } from "../lib/thumbnails.js";

// Stop starting new screenshots after this long (the function may run 60s)
const TIME_BUDGET_MS = 45 * 1000;

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const started = Date.now();
  const env = settings();
  const results = [];

  try {
    const rows = await fetchRowsWithoutThumbnail({
      token: env.notion.token,
      databaseId: process.env.NOTION_DATABASE_ID,
    });

    for (const { id, row } of rows) {
      if (Date.now() - started > TIME_BUDGET_MS) {
        results.push({ title: row.title, result: "skipped (out of time, next run)" });
        continue;
      }
      try {
        await makeThumbnail(env, id, row);
        results.push({ title: row.title, result: "captured" });
      } catch (err) {
        if (err instanceof QuotaError) {
          results.push({ title: row.title, result: "stopped (limit reached, next run)" });
          break;
        }
        console.error(err);
        results.push({ title: row.title, result: "failed (next run)" });
      }
    }

    res.status(200).json({ missing: rows.length, results });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "Recapture failed" });
  }
}
