# Library

A design inspiration library: website cards sorted by category, managed in Notion.
Live at https://ys-library-iota.vercel.app

Plain HTML, CSS and JavaScript — **no framework, no build step, no install.**
Open the files in any editor (VS Code, Notepad++, etc.), change something, refresh the browser.

## Run it locally

```bash
npm start
```

Then open http://localhost:5173. (Needs Python. Double-clicking `index.html` also
works, but then the cards can't load.)

Locally there's no API, so the site shows the saved copy in `data/cms.json`, and the
Submit form says it only works on the live site.

## Files

| File | What it does | Edit it to… |
|---|---|---|
| `js/config.js` | Site name, footer text, **categories** | add/rename categories, change footer text |
| `css/styles.css` | All styling. Colors & fonts are at the top (`:root`) | change colors, fonts, spacing |
| `index.html` | Page structure and the Submit form | add fields or sections |
| `js/app.js` | Shows the cards, sends the Submit form | change behavior |
| `lib/notion.js` | Reads and adds rows in Notion (used by the files below) | change Notion column names (`PROPS` at the top) |
| `api/cards.js` | Live Notion cards on Vercel (`/api/cards`) | cache time (`CACHE_SECONDS`) |
| `api/submit.js` | Adds visitor submissions to Notion, unpublished (`/api/submit`) | length limits (`LIMITS`) |
| `scripts/sync-notion.mjs` | Saves Notion cards to `data/cms.json` (`npm run sync`) | — |
| `data/cms.json` | Saved copy of the Notion cards, used locally and as backup | don't edit by hand |

## Cards from Notion (headless CMS)

Cards are managed in the **library CMS** Notion database.

- **On Vercel:** the site reads Notion live through `api/cards.js`. Edits in
  Notion appear within about a minute — nothing to run.
- **Locally:** the site reads `data/cms.json`, a saved copy created by
  `npm run sync`. It's also the backup if the live API ever fails.

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

## Visitor submissions

The **Submit** buttons open a form. Each submission becomes a new row in Notion with
`Published` **unchecked**. To approve one, tick `Published` — it appears on the site
within a minute. To reject it, delete the row.

Built-in protection against junk:
- Links must start with `http://` or `https://`, and fields have length limits.
- The category must be one of the existing `type` tags (visitors can't create new tags).
- Visitors can't add ⭐ to pin their own submission.
- A hidden "spam trap" field catches simple bots.

## Setup

**Notion integration (once)**
1. Create an integration at https://www.notion.so/profile/integrations and copy its secret.
2. On its **Capabilities** tab, turn on **Read content** and **Insert content**.
3. In Notion, open the library CMS database → `•••` → **Connections** → add the integration.
4. Copy `.env.example` to `.env` and paste the secret after `NOTION_TOKEN=`.

**Locally, after editing Notion**, refresh the saved copy with:

```bash
npm run sync
```

`.env` holds your secret, so never upload it or put it in the website files.

## Deploy to Vercel

No build step: Vercel serves the files as they are, plus `api/` as functions.
Every push to the `main` branch on GitHub redeploys the site.

1. Put this folder on GitHub (`.env` is excluded by `.gitignore`).
2. On https://vercel.com → **Add New… → Project** → import the repo.
   Framework Preset: **Other**. Leave Build and Output settings empty.
3. Before clicking Deploy, open **Environment Variables** and add:
   - `NOTION_TOKEN` = your integration secret
   - `NOTION_DATABASE_ID` = `4b24498e05e045868c51a9458593651d`
4. Deploy. Check `https://<your-site>.vercel.app/api/cards` shows your cards as JSON.

Changed the secret later? Update it in Vercel → Settings → Environment Variables, then **Redeploy**.

## Ideas for later

- Search box.
- Image upload in the Submit form (would need file storage, e.g. Vercel Blob).
- Rate limiting for submissions if spam becomes a problem.
