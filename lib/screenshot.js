/*
  ============================================================
  SCREENSHOT — captures a picture of a website.
  ============================================================
  Uses Microlink (https://microlink.io). The free plan needs no account
  and allows about 50 screenshots a day — plenty, because each website
  is captured only once and then stored in Notion.

  Optional: for more, get a Microlink API key and add it in Vercel as
  the Environment Variable MICROLINK_API_KEY.
*/

// Size of the browser window the website is captured in
const VIEWPORT = { width: 1440, height: 900 };

// Returns { bytes, contentType } for the website's screenshot.
export async function captureScreenshot(siteUrl) {
  const key = process.env.MICROLINK_API_KEY;
  const api = new URL(key ? "https://pro.microlink.io/" : "https://api.microlink.io/");
  api.searchParams.set("url", siteUrl);
  api.searchParams.set("screenshot", "true");
  api.searchParams.set("meta", "false");
  api.searchParams.set("viewport.width", VIEWPORT.width);
  api.searchParams.set("viewport.height", VIEWPORT.height);

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
