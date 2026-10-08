/*
  ============================================================
  SYNC NOTION → data/cms.json   (optional on Vercel)
  ============================================================
  On Vercel the site reads Notion live through /api/cards.
  data/cms.json is the backup the site uses when that API isn't
  available — e.g. when you run the site locally with
  `npm start`, or if Notion is down.

  Refresh the backup with:
      npm run sync

  Needs a .env file (copy .env.example). No packages to install —
  needs Node 20.6 or newer.
*/

import { writeFile, mkdir } from "node:fs/promises";
import { fetchPublishedCards } from "../lib/notion.js";

try {
  const cards = await fetchPublishedCards({
    token: process.env.NOTION_TOKEN,
    databaseId: process.env.NOTION_DATABASE_ID,
  });

  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(
    new URL("../data/cms.json", import.meta.url),
    JSON.stringify({ syncedAt: new Date().toISOString(), cards }, null, 2) + "\n"
  );
  console.log(`Saved ${cards.length} published card(s) to data/cms.json`);
} catch (err) {
  console.error(err.message, "\nSee .env.example and the README.");
  process.exit(1);
}
