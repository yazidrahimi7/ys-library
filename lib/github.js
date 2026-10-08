/*
  ============================================================
  GITHUB — saves images in the public "assets" repo.
  ============================================================
  Images go to thumbnails/ in the repo named by GITHUB_ASSETS_REPO
  (e.g. "yazidrahimi7/ys-library-assets") and are served by jsDelivr,
  a free CDN for public GitHub files.

  Needs the Environment Variable GITHUB_TOKEN: a fine-grained token
  with "Contents: Read and write" on that one repo only.
*/

const FOLDER = "thumbnails";

// Commits an image and returns its permanent public link.
export async function saveImageToGitHub({ token, repo }, name, image) {
  if (!token || !repo) throw new Error("Missing GITHUB_TOKEN or GITHUB_ASSETS_REPO");

  const ext = image.contentType.split("/")[1]?.replace("jpeg", "jpg") || "png";
  // A timestamp keeps names unique, so a re-capture never overwrites an old file
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const path = `${FOLDER}/${name}-${stamp}.${ext}`;

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "ys-library",
    },
    body: JSON.stringify({
      message: `Add ${path}`,
      content: Buffer.from(image.bytes).toString("base64"),
    }),
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  const { commit } = await res.json();

  // Pinned to the commit, so the link never changes or goes stale
  return `https://cdn.jsdelivr.net/gh/${repo}@${commit.sha}/${path}`;
}
