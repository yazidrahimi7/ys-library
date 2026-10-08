/*
  ============================================================
  QUOTA — how many free screenshots are left today.
  ============================================================
  Microlink's free plan allows 25 screenshots per 24 hours. Every
  Microlink reply says how many are left and when the count resets;
  we save the latest numbers in the assets repo
  (status/screenshots.json), because Vercel functions don't remember
  anything between requests.
*/

import { readFile, putFile } from "./github.js";

const STATUS_PATH = "status/screenshots.json";

// Show the "running low" warning at this many screenshots left (or fewer)
export const LOW_AT = 5;

// Latest known quota: { limit, remaining, resetAt, low, out }.
// resetAt is a timestamp in ms. Once it has passed, the quota is full again.
export async function readQuota(github) {
  const file = await readFile(github, STATUS_PATH).catch(() => null);
  if (!file) return summarize({ limit: 25, remaining: 25, resetAt: 0 });
  const saved = JSON.parse(file.text);
  if (Date.now() >= saved.resetAt) {
    return summarize({ ...saved, remaining: saved.limit, resetAt: 0 });
  }
  return summarize(saved);
}

// Save the numbers from a Microlink reply (see lib/screenshot.js).
export async function saveQuota(github, { limit, remaining, resetAt }) {
  const file = await readFile(github, STATUS_PATH).catch(() => null);
  const text = JSON.stringify({ limit, remaining, resetAt, updatedAt: Date.now() }, null, 2) + "\n";
  await putFile(github, STATUS_PATH, text, `Screenshot quota: ${remaining}/${limit} left`, file?.sha);
}

function summarize(q) {
  return {
    limit: q.limit,
    remaining: q.remaining,
    resetAt: q.resetAt,
    low: q.remaining <= LOW_AT,
    out: q.remaining <= 0,
  };
}
