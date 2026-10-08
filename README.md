# Library

A small web app to save design links and screenshots, sorted by category.

Plain HTML, CSS and JavaScript — **no framework, no build step, no install.**
Open the files in any editor (VS Code, Notepad++, etc.), change something, refresh the browser.

## Run it

Option A — double-click `index.html` (works in Chrome / Edge / Firefox).

Option B — run a tiny local server (recommended, behaves like a real website):

```bash
python -m http.server 5173
```

Then open http://localhost:5173

## Files

| File | What it does | Edit it to… |
|---|---|---|
| `js/config.js` | Site name, footer text, **categories** | add/rename categories, change footer text |
| `css/styles.css` | All styling. Colors & fonts are at the top (`:root`) | change colors, fonts, spacing |
| `index.html` | Page structure, submit / edit form | add fields or sections |
| `js/app.js` | Rendering + submit / edit / delete / export | change behavior |
| `js/db.js` | Saves items in the browser (IndexedDB) | swap storage for a real backend later |
| `lib/notion.js` | Reads published cards from Notion (shared by the two files below) | change Notion column names (`PROPS` at the top) |
| `api/cards.js` | Live Notion cards on Vercel (`/api/cards`) | cache time (`CACHE_SECONDS`) |
| `scripts/sync-notion.mjs` | Saves Notion cards to `data/cms.json` (`npm run sync`) | — |
| `data/cms.json` | Saved copy of the Notion cards, used locally and as backup | don't edit by hand |

## Cards from Notion (headless CMS)

Cards are managed in the **library CMS** Notion database.

- **On Vercel:** the site reads Notion live through `api/cards.js`. Edits in
  Notion appear within about a minute — nothing to run.
- **Locally:** there's no API, so the site reads `data/cms.json`, a saved copy
  created by `npm run sync`. It's also the backup if the live API ever fails.

| Notion column | Used for |
|---|---|
| `title` | Card title. Put **⭐** in it to pin the card to the top |
| `url` | Where the card links (opens in a new tab) |
| `thumbnail` | Image link for the card's small square |
| `description` | Card description |
| `type` | Categories the card appears in (tag names must match the sidebar names in `js/config.js`) |
| `Published` | Only checked rows appear on the site |
| `order` | Position: 1 first, 2 second… Empty = after numbered cards |

Card order in each category: ⭐ cards first → then `order` → then newest.

**Setup once**
1. Create an integration at https://www.notion.so/profile/integrations and copy its secret.
2. In Notion, open the library CMS database → `•••` → **Connections** → add the integration.
3. Copy `.env.example` to `.env` and paste the secret after `NOTION_TOKEN=`.

**Locally, after editing Notion**, refresh the saved copy with:

```bash
npm run sync
```

Then refresh the page. `.env` holds your secret, so never upload it or put it in the website files.

## Deploy to Vercel

No build step: Vercel serves the files as they are, plus `api/cards.js` as a function.

1. Put this folder on GitHub (`.env` is excluded by `.gitignore`).
2. On https://vercel.com → **Add New… → Project** → import the repo.
   Framework Preset: **Other**. Leave Build and Output settings empty.
3. Before clicking Deploy, open **Environment Variables** and add:
   - `NOTION_TOKEN` = your integration secret
   - `NOTION_DATABASE_ID` = `4b24498e05e045868c51a9458593651d`
4. Deploy. Check `https://<your-site>.vercel.app/api/cards` shows your cards as JSON.

Changed the secret later? Update it in Vercel → Settings → Environment Variables, then **Redeploy**.

How fast Notion edits show up: set by `CACHE_SECONDS` in `api/cards.js` (default 60).

## How data is saved

Links and screenshots are stored **in your browser** (IndexedDB), not in files.
That means:

- Data stays on this computer and this browser.
- Clearing browser data deletes it.
- Use **Backup → Export** (bottom of the sidebar) to download a `.json` file with
  everything, including screenshots. Use **Import** to restore it or move it to another computer.

## Adding a screenshot

In the Submit form you can drop an image, click to browse, or paste with **Ctrl+V**
(e.g. after `Win + Shift + S`).

## Ideas for later

- Public site with community submissions → replace `js/db.js` with calls to a backend
  (Supabase, Firebase, or a small Node/Python server). The rest of the app only uses
  `DB.getAll`, `DB.save`, `DB.remove`, so that's the only file to change.
- Search box, tags, automatic screenshots from a URL.
