/*
  ============================================================
  GET /api/cards — live Notion cards for the website (Vercel).
  ============================================================
  Needs two Environment Variables in Vercel → Project → Settings:
    NOTION_TOKEN        your integration secret
    NOTION_DATABASE_ID  4b24498e05e045868c51a9458593651d

  Caching: Vercel keeps the answer for CACHE_SECONDS, so edits in
  Notion show on the site within about a minute, and Notion isn't
  asked again on every visit.
*/

import { fetchPublishedCards } from "../lib/notion.js";

const CACHE_SECONDS = 60;

export default async function handler(req, res) {
  try {
    const cards = await fetchPublishedCards({
      token: process.env.NOTION_TOKEN,
      databaseId: process.env.NOTION_DATABASE_ID,
    });

    // Serve from cache for 60s; after that, keep showing the old answer
    // (up to a day) while a fresh one is fetched in the background.
    res.setHeader(
      "Cache-Control",
      `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=86400`
    );
    res.status(200).json({ syncedAt: new Date().toISOString(), cards });
  } catch (err) {
    // Log the real reason for Vercel's logs, but don't expose details publicly
    console.error(err);
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ error: "Could not load cards from Notion" });
  }
}
