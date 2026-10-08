/*
  ============================================================
  SCREENSHOT — captures a picture of a website.
  ============================================================
  Uses Microlink (https://microlink.io). The free plan needs no account
  and allows 25 screenshots a day — plenty, because each website
  is captured only once.

  Popups (cookie banners, newsletter modals, chat bubbles) are removed
  before the picture is taken, in three ways:
    1. Microlink's ad blocker (on by default) stops most cookie-consent tools.
    2. HIDE_SELECTORS hides known popup elements with CSS.
    3. CLEANUP_SCRIPT removes anything floating over the page, and keeps
       doing so for WAIT_MS to catch popups that appear late.
  Some sites block screenshot tools entirely — paste a thumbnail link in
  Notion for those.

  Optional: for more than 25 a day, get a Microlink API key (paid) and add it
  in Vercel as the Environment Variable MICROLINK_API_KEY.
*/

// Size of the browser window the website is captured in
const VIEWPORT = { width: 1440, height: 900 };

// How long to wait (and keep removing popups) before the picture
const WAIT_MS = 3000;

// Popup elements to hide. Add a selector here if a site's popup still shows.
const HIDE_SELECTORS = [
  // Common cookie-consent tools
  "#onetrust-consent-sdk", "#CybotCookiebotDialog", "#usercentrics-root", "#didomi-host",
  ".fc-consent-root", ".qc-cmp2-container", "#truste-consent-track", ".cc-window",
  '[class*="cookie-banner" i]', '[id*="cookie-banner" i]',
  '[class*="cookie-consent" i]', '[id*="cookie-consent" i]', '[class*="consent-banner" i]',
  // Modals and their dark backgrounds
  '[aria-modal="true"]', '[role="dialog"]', '[role="alertdialog"]',
  '[class*="modal-backdrop" i]', '[class*="ReactModal__Overlay"]', '[class*="popup-overlay" i]',
  // Chat widgets
  "#intercom-container", ".intercom-lightweight-app", "#hubspot-messages-iframe-container",
];

// Runs inside the website before the picture. Removes "fixed" elements that
// float over the page — big overlays, or bars/bubbles in the lower part of the
// screen — but keeps headers and sidebars. Also re-enables scrolling.
const CLEANUP_SCRIPT = `(() => {
  const clean = () => {
    const vw = innerWidth, vh = innerHeight;
    for (const el of document.querySelectorAll("body *")) {
      const s = getComputedStyle(el);
      if (s.position !== "fixed") continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const coversScreen = r.width * r.height > vw * vh * 0.5;
      const floatsLow = r.top > vh * 0.4 && r.height < vh * 0.6;
      if (coversScreen || floatsLow) el.remove();
    }
    for (const n of [document.documentElement, document.body]) {
      n.style.setProperty("overflow", "auto", "important");
    }
  };
  clean();
  const timer = setInterval(clean, 500);
  setTimeout(() => clearInterval(timer), ${WAIT_MS});
})()`;

// A cleaned screenshot smaller than this is probably a blank page: some sites
// put their whole page in a floating layer, which the cleanup removes too.
const NEARLY_EMPTY_BYTES = 50 * 1024;

// Returns { bytes, contentType } for the website's screenshot.
export async function captureScreenshot(siteUrl) {
  const cleaned = await capture(siteUrl, { cleanup: true });
  if (cleaned.bytes.length >= NEARLY_EMPTY_BYTES) return cleaned;

  // Nearly empty: try again without the cleanup script, keep the fuller picture
  const plain = await capture(siteUrl, { cleanup: false }).catch(() => cleaned);
  return plain.bytes.length > cleaned.bytes.length ? plain : cleaned;
}

// The free plan only handles a few screenshots at the same time, so when a
// page asks for several at once some fail. Wait a moment and try once more.
async function capture(siteUrl, options) {
  try {
    return await captureOnce(siteUrl, options);
  } catch {
    await new Promise((r) => setTimeout(r, 3000));
    return captureOnce(siteUrl, options);
  }
}

async function captureOnce(siteUrl, { cleanup }) {
  const key = process.env.MICROLINK_API_KEY;
  const api = new URL(key ? "https://pro.microlink.io/" : "https://api.microlink.io/");
  const params = {
    url: siteUrl,
    screenshot: "true",
    meta: "false",
    adblock: "true",
    "viewport.width": VIEWPORT.width,
    "viewport.height": VIEWPORT.height,
    waitForTimeout: WAIT_MS,
    // Each rule has no commas, because Microlink splits this list on commas
    styles: HIDE_SELECTORS.map((s) => `${s}{display:none !important}`).join(","),
  };
  if (cleanup) params.scripts = CLEANUP_SCRIPT;
  for (const [k, v] of Object.entries(params)) api.searchParams.set(k, v);

  const res = await fetch(api, { headers: key ? { "x-api-key": key } : {} });
  const data = await res.json().catch(() => ({}));
  const imageUrl = data?.data?.screenshot?.url;
  if (!res.ok || data.status !== "success" || !imageUrl) {
    throw new Error(`Screenshot failed for ${siteUrl}: ${res.status} ${data.message || ""}`);
  }

  return downloadImage(imageUrl);
}

// Downloads an image and returns { bytes, contentType }.
export async function downloadImage(imageUrl) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Image download ${res.status}: ${imageUrl}`);
  return {
    bytes: new Uint8Array(await res.arrayBuffer()),
    contentType: res.headers.get("content-type") || "image/png",
  };
}
