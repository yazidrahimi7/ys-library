# Library

A design inspiration library: website cards sorted by category, managed in Notion.
Live at https://ylibrary.vercel.app

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
| `js/config.js` | Site text, search placeholder, **categories and sidebar groups** | add/rename categories, change text |
| `css/styles.css` | All styling. Colors, font and sizes are at the top (`:root`) | change colors, fonts, spacing, cards per row |
| `index.html` | Page structure and the Submit form | add fields or sections |
| `js/app.js` | Sidebar, Featured/category sections, search, Submit form | change behavior (e.g. `PREVIEW_COUNT`) |
| `lib/notion.js` | Reads and adds rows in Notion (used by the files below) | change Notion column names (`PROPS` at the top) |
| `api/cards.js` | Live Notion cards on Vercel (`/api/cards`) | cache time (`CACHE_SECONDS`) |
| `api/submit.js` | Adds visitor submissions to Notion, unpublished (`/api/submit`) | length limits (`LIMITS`) |
| `api/thumb.js` | Screenshots websites for cards with no thumbnail (`/api/thumb`) | — |
| `lib/screenshot.js` | Captures a website screenshot (Microlink) | screenshot size (`VIEWPORT`) |
| `lib/github.js` | Saves files to the ys-library-assets repo | folder name (`FOLDER`) |
| `lib/thumbnails.js` | Screenshot → GitHub → Notion link, shared by the two APIs below | — |
| `lib/quota.js` | Tracks how many free screenshots are left | warning level (`LOW_AT`) |
| `api/quota.js` | Screenshot quota for the Submit form's note (`/api/quota`) | — |
| `api/recapture.js` | Daily catch-up for cards still missing an image | time budget |
| `scripts/sync-notion.mjs` | Saves Notion cards to `data/cms.json` (`npm run sync`) | — |
| `data/cms.json` | Saved copy of the Notion cards, used locally and as backup | don't edit by hand |

## Pages

- **All** (`#all`): a **Featured** row (cards tagged `Featured` in Notion), then up to
  8 cards from each category that has any, with a **View all** button when there are more.
- **A category** (e.g. `#web`): every card in that category.
- **Search**: type in the search bar to search titles, descriptions, links and
  categories across all cards. `Esc` clears it.

Icons are from [Feather](https://feathericons.com): write `<i data-feather="name"></i>`
in the HTML, or `icon("name")` in `js/app.js`.

## Cards from Notion (headless CMS)

Cards are managed in the **library CMS** Notion database.

- **On Vercel:** the site reads Notion live through `api/cards.js`. Edits in
  Notion appear within about a minute — nothing to run.
- **Locally:** the site reads `data/cms.json`, a saved copy created by
  `npm run sync`. It's also the backup if the live API ever fails.

| Notion column | Used for |
|---|---|
| `title` | Card title. Put **⭐** in it to pin the card to the top |
| `url` | Where the card links (opens in a new tab). `https://` is added if missing |
| `thumbnail` | Image link for the card. Leave empty to get an automatic screenshot |
| `description` | Card description |
| `type` | Categories the card appears in (tag names must match the sidebar names in `js/config.js`). Add the **Featured** tag to also show it in the Featured row |
| `Published` | Only checked rows appear on the site |
| `order` | Optional Number column. Position: 1 first, 2 second… Empty = after numbered cards |

Card order in each category: ⭐ cards first → then `order` → then newest.

## Automatic screenshots

When a card's `thumbnail` is empty, the first visit to the live site:

1. captures a screenshot of the website (via [Microlink](https://microlink.io), free plan: 25 per day),
2. saves it in the public **ys-library-assets** GitHub repo, in `thumbnails/`,
3. writes its permanent link (served by [jsDelivr](https://www.jsdelivr.com)) into the
   row's `thumbnail` column in Notion.

After that the card just uses that link, so each website is captured only once.

- Popups (cookie banners, newsletter modals, chat bubbles) are removed before the
  picture is taken. If one still shows, add its CSS selector to `HIDE_SELECTORS` in
  `lib/screenshot.js`, then clear that card's `thumbnail` to capture it again.
- **Daily limit:** the free plan allows 25 screenshots per 24 hours. The remaining count
  is saved in `status/screenshots.json` in the assets repo. When 5 or fewer are left,
  the Submit form shows a small note. When none are left, screenshots pause (cards show
  a grey box) and resume automatically after the reset — on the next visit, or the daily
  catch-up run (`api/recapture.js`, 06:00 UTC, set in `vercel.json`).
- Some sites block screenshot tools completely (e.g. "Access Denied") — paste your own
  image link in `thumbnail` for those.
- Want a different image? Replace the link in `thumbnail`.
- Want a fresh screenshot? Clear `thumbnail` — the next visit captures a new one.
- Old screenshots in Notion's `screenshot` column are moved to GitHub automatically;
  after that the column isn't used and can be deleted.
- Only works on the live site (locally, cards without a thumbnail show a grey box).

**Setup:** create a fine-grained GitHub token at https://github.com/settings/personal-access-tokens
with access to **only** `ys-library-assets` and **Contents: Read and write**. In Vercel, add:
- `GITHUB_TOKEN` = that token
- `GITHUB_ASSETS_REPO` = `yazidrahimi7/ys-library-assets`
- `CRON_SECRET` = any long random text (protects the daily catch-up run)

## Visitor submissions

The **Submit** buttons open a form. Each submission becomes a new row in Notion with
`Published` **unchecked**. To approve one, tick `Published` — it appears on the site
within a minute. To reject it, delete the row.

Built-in protection against junk:
- Links must start with `http://` or `https://`, and fields have length limits.
- The category must be one of the existing `type` tags (visitors can't create new tags).
- Visitors can't add ⭐ to pin their own submission, or pick the Featured tag.
- A hidden "spam trap" field catches simple bots.

## Setup

**Notion integration (once)**
1. Create an integration at https://www.notion.so/profile/integrations and copy its secret.
2. On its **Capabilities** tab, turn on **Read content**, **Update content** and **Insert content**.
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

- Image upload in the Submit form.
- Rate limiting for submissions if spam becomes a problem.
