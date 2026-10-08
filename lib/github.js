/*
  ============================================================
  GITHUB — saves files in the public "assets" repo.
  ============================================================
  Images go to thumbnails/ in the repo named by GITHUB_ASSETS_REPO
  (e.g. "yazidrahimi7/ys-library-assets") and are served by jsDelivr,
  a free CDN for public GitHub files. The screenshot quota is kept in
  status/screenshots.json (see lib/quota.js).

  Needs the Environment Variable GITHUB_TOKEN: a fine-grained token
  with "Contents: Read and write" on that one repo only.
*/

const FOLDER = "thumbnails";

// Commits an image and returns its permanent public link.
export async function saveImageToGitHub(github, name, image) {
  const ext = image.contentType.split("/")[1]?.replace("jpeg", "jpg") || "png";
  // A timestamp keeps names unique, so a re-capture never overwrites an old file
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const path = `${FOLDER}/${name}-${stamp}.${ext}`;

  const { commit } = await putFile(github, path, image.bytes, `Add ${path}`);
  // Pinned to the commit, so the link never changes or goes stale
  return `https://cdn.jsdelivr.net/gh/${github.repo}@${commit.sha}/${path}`;
}

// Reads a text file. Returns { text, sha }, or null if it doesn't exist yet.
export async function readFile(github, path) {
  const res = await request(github, path, { method: "GET" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { text: Buffer.from(data.content, "base64").toString("utf8"), sha: data.sha };
}

// Creates or updates a file. Pass `sha` (from readFile) to update an existing one.
export async function putFile(github, path, content, message, sha) {
  const res = await request(github, path, {
    method: "PUT",
    body: JSON.stringify({ message, content: Buffer.from(content).toString("base64"), sha }),
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  return res.json();
}

function request({ token, repo }, path, options) {
  if (!token || !repo) throw new Error("Missing GITHUB_TOKEN or GITHUB_ASSETS_REPO");
  return fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "ys-library",
    },
  });
}
