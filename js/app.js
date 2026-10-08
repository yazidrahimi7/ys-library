/*
  ============================================================
  APP — renders the page and handles submit / edit / delete.
  Cards come from two places: Notion (data/cms.json) and links
  saved in this browser with the Submit form.
  ============================================================
  Sections in this file:
    1. Setup & state
    2. Rendering (sidebar, cards)
    3. Submit / edit form
    4. Delete
    5. Export / import backup
    6. Helpers
    7. Start
*/

/* ---------- 1. Setup & state ---------- */

const config = window.LIBRARY_CONFIG;
const allCategories = config.groups.flatMap((g) => g.categories);

const state = {
  items: [],                          // links saved in this browser (Submit form)
  cms: [],                            // published cards from Notion (data/cms.json)
  activeId: allCategories[0].id,      // selected category
  editingId: null,                    // id of the item being edited (null = new)
  formImage: null,                    // screenshot Blob chosen in the form
};

// Object URLs we create for screenshots, so we can free them on re-render.
let objectUrls = [];

const $ = (sel) => document.querySelector(sel);
const grid = $("#grid");
const nav = $("#category-nav");
const formDialog = $("#form-dialog");
const form = $("#item-form");

/* ---------- 2. Rendering ---------- */

function renderSidebar() {
  nav.innerHTML = "";
  for (const group of config.groups) {
    const wrap = el("div", "group");
    wrap.append(el("h3", "group-name", group.name));

    for (const cat of group.categories) {
      const count = cardsFor(cat.id).length;
      const btn = el("button", "cat" + (cat.id === state.activeId ? " is-active" : ""));
      btn.append(el("span", "", cat.name));
      if (count) btn.append(el("span", "cat-count", String(count)));
      btn.addEventListener("click", () => (location.hash = cat.id));
      wrap.append(btn);
    }
    nav.append(wrap);
  }
}

function renderGrid() {
  objectUrls.forEach(URL.revokeObjectURL);
  objectUrls = [];
  grid.innerHTML = "";

  const cat = allCategories.find((c) => c.id === state.activeId);
  $("#page-title").textContent = cat.title || cat.name;
  document.title = `${cat.name} · ${config.siteName}`;

  const items = cardsFor(state.activeId);

  if (!items.length) {
    const empty = el("div", "empty");
    empty.append(el("p", "", `Nothing saved in ${cat.name} yet.`));
    const btn = el("button", "btn btn-primary", "+ Submit the first one");
    btn.addEventListener("click", () => openForm());
    empty.append(btn);
    grid.append(empty);
    return;
  }

  for (const item of items) {
    const card = el("article", "card");

    // Notion cards use a thumbnail link; local cards use the saved screenshot
    const thumbSrc = item.thumbnail || (item.image && imageUrl(item.image));
    if (thumbSrc) {
      const img = el("img", "card-thumb");
      img.src = thumbSrc;
      img.alt = "";
      img.loading = "lazy";
      card.append(img);
    } else {
      card.append(el("div", "card-thumb"));
    }

    // The title link stretches over the whole card (see .card-link in CSS),
    // so clicking anywhere on the card opens the website in a new tab.
    const title = el("h4", "card-title");
    const link = el("a", "card-link", item.title);
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener";
    title.append(link);
    card.append(title);

    if (item.description) card.append(el("p", "card-desc", item.description));

    // Notion cards are edited in Notion, so only local cards get an Edit button
    if (!item.fromNotion) {
      const edit = el("button", "card-edit", "Edit");
      edit.setAttribute("aria-label", `Edit ${item.title}`);
      edit.addEventListener("click", () => openForm(item));
      card.append(edit);
    }

    grid.append(card);
  }
}

// All cards for one category: Notion cards + links saved in this browser.
// Order: ⭐ in the title first, then by Notion "order" (empty = last), then newest.
function cardsFor(categoryId) {
  const notion = state.cms.filter((c) => c.categories.includes(categoryId));
  const local = state.items.filter((i) => i.category === categoryId);
  return [...notion, ...local].sort(
    (a, b) =>
      isStarred(b) - isStarred(a) ||
      (a.order ?? Infinity) - (b.order ?? Infinity) ||
      b.createdAt - a.createdAt
  );
}

function isStarred(item) {
  return item.title.includes("⭐") ? 1 : 0;
}

function render() {
  renderSidebar();
  renderGrid();
}

/* ---------- 3. Submit / edit form ---------- */

function fillCategorySelect() {
  const select = $("#category-select");
  for (const group of config.groups) {
    const og = document.createElement("optgroup");
    og.label = group.name;
    for (const cat of group.categories) {
      const opt = el("option", "", cat.name);
      opt.value = cat.id;
      og.append(opt);
    }
    select.append(og);
  }
}

function openForm(item = null) {
  form.reset();
  state.editingId = item ? item.id : null;
  $("#form-title").textContent = item ? "Edit website" : "Submit a website";
  $("#delete-btn").hidden = !item;
  form.url.value = item ? item.url : "";
  form.title.value = item ? item.title : "";
  form.description.value = item ? item.description : "";
  form.category.value = item ? item.category : state.activeId;
  setFormImage(item ? item.image : null);
  formDialog.showModal();
  form.url.focus();
}

function setFormImage(blob) {
  state.formImage = blob;
  const preview = $("#preview");
  if (blob) {
    preview.src = imageUrl(blob);
    preview.hidden = false;
    $("#dropzone-hint").hidden = true;
    $("#remove-image").hidden = false;
  } else {
    preview.removeAttribute("src");
    preview.hidden = true;
    $("#dropzone-hint").hidden = false;
    $("#remove-image").hidden = true;
  }
}

function acceptImageFile(file) {
  if (file && file.type.startsWith("image/")) setFormImage(file);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const url = normalizeUrl(form.url.value);
  const existing = state.items.find((i) => i.id === state.editingId);

  const item = {
    id: existing ? existing.id : makeId(),
    url,
    title: form.title.value.trim() || hostname(url),
    description: form.description.value.trim(),
    category: form.category.value,
    image: state.formImage,
    createdAt: existing ? existing.createdAt : Date.now(),
  };

  await DB.save(item);
  await loadItems();
  formDialog.close();

  // Jump to the category the item was saved in
  if (item.category !== state.activeId) location.hash = item.category;
  else render();
});

// Screenshot: click to browse, drag & drop, or paste
const dropzone = $("#dropzone");
const imageInput = $("#image-input");

dropzone.addEventListener("click", () => imageInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); imageInput.click(); }
});
imageInput.addEventListener("change", () => acceptImageFile(imageInput.files[0]));
dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("is-over"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-over"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("is-over");
  acceptImageFile(e.dataTransfer.files[0]);
});
document.addEventListener("paste", (e) => {
  if (!formDialog.open) return;
  const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
  if (file) { e.preventDefault(); acceptImageFile(file); }
});
$("#remove-image").addEventListener("click", () => setFormImage(null));

/* ---------- 4. Delete (from the edit form) ---------- */

$("#delete-btn").addEventListener("click", async () => {
  const item = state.items.find((i) => i.id === state.editingId);
  if (!item || !confirm(`Delete "${item.title}"?`)) return;
  await DB.remove(item.id);
  formDialog.close();
  await loadItems();
  render();
});

/* ---------- 5. Export / import backup ---------- */

$("#export-btn").addEventListener("click", async () => {
  const data = await Promise.all(
    state.items.map(async (i) => ({ ...i, image: i.image ? await blobToDataUrl(i.image) : null }))
  );
  const file = new Blob([JSON.stringify({ version: 1, items: data }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = `library-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$("#import-btn").addEventListener("click", () => $("#import-file").click());

$("#import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const { items } = JSON.parse(await file.text());
    for (const i of items) {
      await DB.save({ ...i, image: i.image ? dataUrlToBlob(i.image) : null });
    }
    await loadItems();
    render();
    alert(`Imported ${items.length} item(s).`);
  } catch (err) {
    alert("Could not import that file. Is it a Library backup?");
    console.error(err);
  }
});

/* ---------- 6. Helpers ---------- */

// Create an element with an optional class and text.
function el(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function imageUrl(blob) {
  const url = URL.createObjectURL(blob);
  objectUrls.push(url);
  return url;
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// "example.com" -> "https://example.com"
function normalizeUrl(value) {
  const v = value.trim();
  return /^https?:\/\//i.test(v) ? v : "https://" + v;
}

function hostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(",");
  const type = head.match(/data:(.*?);/)[1];
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type });
}

async function loadItems() {
  state.items = await DB.getAll();
}

// Where Notion cards come from, tried in order:
//   1. api/cards      — live from Notion (on Vercel, see api/cards.js)
//   2. data/cms.json  — backup saved by `npm run sync` (used when running locally)
const CMS_SOURCES = ["api/cards", "data/cms.json"];

// Each Notion "type" tag is matched to a category by name, e.g. "Web" → #web.
async function loadCms() {
  const cards = await fetchFirstWorking(CMS_SOURCES);
  const byName = (name) =>
    allCategories.find((c) => c.name.toLowerCase() === name.toLowerCase() || c.id === name.toLowerCase());

  state.cms = cards.map((c) => ({
    ...c,
    categories: c.types.map(byName).filter(Boolean).map((cat) => cat.id),
    createdAt: Date.parse(c.createdAt) || 0,
    fromNotion: true,
  }));
}

async function fetchFirstWorking(urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const { cards } = await res.json();
      if (Array.isArray(cards)) return cards;
    } catch {
      // Not available here (or not JSON) — try the next source
    }
  }
  console.warn("No Notion cards available; showing local links only");
  return [];
}

// Read the active category from the URL (#web, #figma, ...)
function readHash() {
  const id = location.hash.slice(1);
  state.activeId = allCategories.some((c) => c.id === id) ? id : allCategories[0].id;
}

/* ---------- 7. Start ---------- */

function fillStaticText() {
  document.querySelectorAll("[data-site-name]").forEach((n) => (n.textContent = config.siteName));
  const f = config.footer;
  $('[data-footer="heading"]').textContent = f.heading;
  $('[data-footer="text"]').textContent = f.text;
  $('[data-footer="credit"]').textContent = f.credit;
  $('[data-footer="link"]').textContent = f.linkLabel;
  $('[data-footer="link"]').href = f.linkUrl;
}

document.querySelectorAll("[data-open-submit]").forEach((b) => b.addEventListener("click", () => openForm()));
document.querySelectorAll("[data-close]").forEach((b) =>
  b.addEventListener("click", () => b.closest("dialog").close())
);
// Close the form when clicking the dark backdrop
formDialog.addEventListener("click", (e) => {
  const r = formDialog.getBoundingClientRect();
  const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  if (e.target === formDialog && outside) formDialog.close();
});

window.addEventListener("hashchange", () => {
  readHash();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

(async function start() {
  fillStaticText();
  fillCategorySelect();
  readHash();
  await Promise.all([loadItems(), loadCms()]);
  render();
})();
